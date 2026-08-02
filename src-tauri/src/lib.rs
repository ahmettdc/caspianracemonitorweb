use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;

/* Pencereyi tepsiden geri getir (gizli/simge durumundaysa). */
fn show_main(app: &AppHandle) {
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
    // Sürüş Modu (v1.4.99): görünür oldu → ön yüz ağır render'ı geri açsın.
    let _ = app.emit("win-visible", true);
  }
}

/* Geçici loopback OAuth sunucusu (127.0.0.1:PORT) başlatır; sistem tarayıcısı
   redirect'le döndüğünde tam URL'yi "oauth://url" olayıyla ön yüze iletir. */
#[tauri::command]
fn start_oauth_server(app: AppHandle) -> Result<u16, String> {
  tauri_plugin_oauth::start(move |url| {
    let _ = app.emit("oauth://url", url);
  })
  .map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_oauth_server(port: u16) -> Result<(), String> {
  tauri_plugin_oauth::cancel(port).map_err(|e| e.to_string())
}

/* Verilen URL'yi kullanıcının VARSAYILAN sistem tarayıcısında açar (gömülü
   WebView2'de değil) — Google OAuth gömülü tarayıcıları reddettiği için şart. */
#[tauri::command]
fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
  app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/* Authorization code'u (PKCE) Google token uç noktasında id_token'a çevirir.
   client_secret derleme zamanı ortam değişkeninden gelir — kaynak koda gömülmez.
   ("Desktop app" tipi OAuth istemcisinin secret'ı Google tarafında gizli kabul
   edilmez; yine de public repoya yazmamak için env'den okunur.) */
#[tauri::command]
async fn exchange_google_code(
  code: String,
  code_verifier: String,
  redirect_uri: String,
  client_id: String,
) -> Result<String, String> {
  let secret = option_env!("GOOGLE_OAUTH_CLIENT_SECRET").unwrap_or("");
  let params = [
    ("code", code.as_str()),
    ("client_id", client_id.as_str()),
    ("client_secret", secret),
    ("redirect_uri", redirect_uri.as_str()),
    ("grant_type", "authorization_code"),
    ("code_verifier", code_verifier.as_str()),
  ];
  let resp = reqwest::Client::new()
    .post("https://oauth2.googleapis.com/token")
    .form(&params)
    .send()
    .await
    .map_err(|e| e.to_string())?;
  let status = resp.status();
  let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
  if !status.is_success() {
    return Err(format!("token uç noktası {}: {}", status, body));
  }
  body
    .get("id_token")
    .and_then(|v| v.as_str())
    .map(str::to_string)
    .ok_or_else(|| "yanıtta id_token yok".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Sürüş PC'sinde oyunla CPU çekişmesini azalt: uygulamayı BELOW_NORMAL önceliğe al.
  // Builder'dan ÖNCE → sonradan spawn edilen çocuklar (WebView2 render/GPU süreçleri +
  // Command.sidecar ile başlayan köprü) bu önceliği miras alır. BELOW_NORMAL yalnız
  // ÇEKİŞMEDE etkilidir: oyun (NORMAL) önceliklenir, boş çekirdek yine bize kalır →
  // izleyici PC'de (oyun yok) hiçbir yavaşlama olmaz. Kullanıcı raporu: köprü açıkken
  // oyunda takılma; kapatınca gidiyor.
  #[cfg(windows)]
  unsafe {
    use windows_sys::Win32::System::Threading::{
      GetCurrentProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS,
    };
    SetPriorityClass(GetCurrentProcess(), BELOW_NORMAL_PRIORITY_CLASS);
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec![]),
    ))
    .invoke_handler(tauri::generate_handler![
      start_oauth_server,
      stop_oauth_server,
      open_external_url,
      exchange_google_code
    ])
    // Pencereyi (X) kapatınca uygulama kapanmasın — gizle, sistem tepsisinde
    // çalışmaya devam etsin (canlı köprü veri akışı kesilmesin). Gerçek çıkış
    // yalnız tepsi menüsündeki "Çıkış" iledir.
    .on_window_event(|window, event| match event {
      // (X) → kapatma yerine gizle; sistem tepsisinde çalışmaya devam et.
      tauri::WindowEvent::CloseRequested { api, .. } => {
        let _ = window.hide();
        api.prevent_close();
        // Sürüş Modu (v1.4.99): pencere gizlendi → ön yüz ağır render'ı durdursun
        // (köprü modül-global state'ten yazmaya devam eder; mühendis başka PC'de görür).
        let _ = window.emit("win-visible", false);
      }
      // Odak değişimi: tam-ekran oyunun arkasına düşme / minimize / geri gelme.
      // Ön yüz, köprü CANLI oyun verisi yazarken (sürüş PC'si yarışta) odak yokken
      // ağır render'ı durdurur; ikinci monitörde izleyen mühendisi etkilemez.
      tauri::WindowEvent::Focused(focused) => {
        let _ = window.emit("win-focus", *focused);
      }
      _ => {}
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // ---- Sistem tepsisi (bildirim alanı) ikonu + menüsü ----
      let show_i = MenuItem::with_id(app, "show", "Göster", true, None::<&str>)?;
      let autostart_on = app.autolaunch().is_enabled().unwrap_or(false);
      let auto_i = CheckMenuItem::with_id(
        app, "autostart", "Windows açılışında başlat", true, autostart_on, None::<&str>,
      )?;
      let quit_i = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_i, &auto_i, &quit_i])?;

      let auto_ref = auto_i.clone();
      TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Caspian Race Monitor")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
          "show" => show_main(app),
          "quit" => app.exit(0),
          "autostart" => {
            let mgr = app.autolaunch();
            let now = mgr.is_enabled().unwrap_or(false);
            let _ = if now { mgr.disable() } else { mgr.enable() };
            let _ = auto_ref.set_checked(mgr.is_enabled().unwrap_or(!now));
          }
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            show_main(tray.app_handle());
          }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

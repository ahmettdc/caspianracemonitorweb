use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

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
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      start_oauth_server,
      stop_oauth_server,
      open_external_url,
      exchange_google_code
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/* Global tema / CSS — App.jsx tarafindan bir kez <style> olarak enjekte edilir. */
export const css = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
:root{
  /* Pit Wall OS — #960018 merkezli, koyu + sıcak "pit-wall" kimliği (konseptten).
     Zemin sıcak yakın-siyah, paneller bürgündi; marka #960018, etkileşim lift'i
     #C51E38→#D24357; anlamsal renkler (good/warn/crit/best) markadan ayrı. */
  --bg:#0B0708; --panel:#150E10; --panel2:#1E1418; --line:#34232A; --line2:#4A2F38;
  --txt:#F3EAEC; --dim:#B199A0; --muted:#8A7176;
  --teal:#D24357; --accent:#D24357; --brand2:#C51E38; --car:#960018; --green:#37D67A;
  --yellow:#F5B23D; --red:#FF4D5E; --purple:#B58BFF;
}
.rc *{box-sizing:border-box}
.rc{min-height:100vh;background:var(--bg);color:var(--txt);
  font-family:'Inter',system-ui,sans-serif;font-size:13px;padding:0 0 40px}
.rc .mono{font-family:'IBM Plex Mono',monospace}
.rc .disp{font-family:'Rajdhani',sans-serif;letter-spacing:.04em}
.rc header{display:flex;align-items:center;gap:12px;padding:14px 20px;
  border-bottom:1px solid var(--line)}
.rc header h1{margin:0;font-size:26px;font-weight:700;text-transform:uppercase;line-height:1}
.rc header h1 b{color:var(--teal)}
.rc header .ver{color:var(--dim);font-size:12px;margin-left:-4px;align-self:flex-end;
  padding-bottom:2px}
.rc .grid{display:grid;grid-template-columns:300px 1fr;gap:16px;padding:16px 20px;
  align-items:start;transition:grid-template-columns .28s ease,gap .28s ease}
.rc .grid.noside{grid-template-columns:0px 1fr;gap:0}
.rc .sidecol{overflow:hidden;min-width:0}
.rc .sideinner{width:300px;transition:opacity .22s ease}
.rc .grid.noside .sideinner{opacity:0;pointer-events:none}
.rc .sidetoggle{position:fixed;left:0;top:50%;transform:translateY(-50%);z-index:40;
  width:20px;height:72px;padding:0;border:1px solid var(--line);border-left:none;
  border-radius:0 10px 10px 0;background:var(--panel2);color:var(--dim);
  cursor:pointer;font-size:11px;line-height:1;transition:color .15s,border-color .15s}
.rc .sidetoggle:hover{color:var(--teal);border-color:var(--teal)}
@media(max-width:900px){.rc .grid{grid-template-columns:1fr}.rc .sidetoggle{display:none}}
.rc .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
.rc .card h2{margin:0 0 10px;font-size:15px;text-transform:uppercase;
  font-family:'Rajdhani';letter-spacing:.08em;color:var(--teal)}
.rc label{display:block;color:var(--dim);font-size:11px;margin:8px 0 3px;
  text-transform:uppercase;letter-spacing:.05em}
.rc input[type=text],.rc input[type=number],.rc input[type=datetime-local]{width:100%;background:var(--panel2);
  border:1px solid var(--line);border-radius:6px;color:var(--txt);
  padding:6px 8px;font-family:'IBM Plex Mono',monospace;font-size:13px}
.rc input:focus{outline:2px solid var(--teal);outline-offset:-1px}
/* sayı alanlarında yukarı/aşağı ok her zaman görünür (madde: elle girme yerine tıkla) */
.rc input[type=number]{-moz-appearance:auto;appearance:auto}
.rc input[type=number]::-webkit-inner-spin-button,
.rc input[type=number]::-webkit-outer-spin-button{
  -webkit-appearance:inner-spin-button;appearance:auto;opacity:1;
  height:24px;cursor:pointer;filter:invert(.85) hue-rotate(300deg)}
.rc .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rc .row4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.rc .strat{display:flex;gap:6px;margin-top:4px}
.rc .strat button{flex:1;padding:7px 0;border-radius:6px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-family:'Rajdhani';
  font-size:15px;font-weight:600;cursor:pointer}
.rc .strat button.on{background:var(--car);color:#FFE9ED;border-color:var(--teal)}
.rc .tabs{display:flex;gap:8px;margin-bottom:12px}
.rc .tabs button{padding:8px 16px;border-radius:8px 8px 0 0;border:1px solid var(--line);
  border-bottom:none;background:transparent;color:var(--dim);cursor:pointer;
  font-family:'Rajdhani';font-size:16px;font-weight:600;letter-spacing:.05em;
  text-transform:uppercase}
.rc .tabs button.on{background:var(--panel);color:var(--txt);border-color:var(--teal)}
.rc table{width:100%;border-collapse:collapse}
.rc th{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.rc td{padding:7px 8px;border-bottom:1px solid #2E1D21;font-family:'IBM Plex Mono',monospace;
  font-size:12.5px}
.rc tr.last td{background:rgba(64,214,140,.06)}
.rc .neg{color:var(--red)} .rc .pos{color:var(--green)}
.rc .chip{display:inline-block;padding:1px 7px;border-radius:99px;font-size:11px;
  border:1px solid var(--line);color:var(--dim)}
.rc .tyrebox{display:inline-flex;gap:3px;margin-right:8px}
.rc .tyrebox button{width:26px;height:22px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:9px;cursor:pointer;
  font-family:'IBM Plex Mono'}
.rc .tyrebox button.on{background:var(--yellow);color:#3A2E00;border-color:var(--yellow)}
.rc .tyrebox button.qual{background:#4D9FFF;color:#04213F;border-color:#4D9FFF}
.rc .tyrebox button.wet{background:#7FE3A0;color:#0C3A1F;border-color:#7FE3A0}
.rc .tyrebox button.used{background:#0B0D12;color:#E8E8EE;border-color:#6B7280;
  box-shadow:inset 0 0 0 1px #2a2e38}
.rc .pitopt{display:inline-flex;gap:4px}
.rc .pitopt button{padding:2px 8px;border-radius:4px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:10px;cursor:pointer}
.rc .pitopt button:disabled{opacity:.35;cursor:not-allowed}
.rc .pitopt button.on{background:var(--car);color:#FFE9ED;border-color:var(--teal)}
.rc .ovr{width:82px!important;padding:3px 6px!important;font-size:11px!important}
.rc .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:10px;margin-bottom:14px}
.rc .kpi{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:10px}
.rc .kpi .v{font-family:'Rajdhani';font-size:24px;font-weight:700;line-height:1}
.rc .kpi .l{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  margin-top:4px}
.rc .timeline{height:34px;display:flex;border-radius:6px;overflow:hidden;
  border:1px solid var(--line);margin:4px 0 14px}
.rc .timeline .seg{position:relative;min-width:2px}
.rc .timeline .seg span{position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;font-family:'Rajdhani';font-size:12px;font-weight:700;
  color:#FFE3E8;letter-spacing:.02em;overflow:hidden}
.rc .timeline .pit{background:var(--yellow)}
/* pilot şeridi (timeline omurgasının altı) */
.rc .drvlane{position:relative;display:flex;height:20px;margin:-8px 0 14px}
.rc .drvlane .dcell{display:flex;align-items:center;justify-content:center;overflow:hidden;
  white-space:nowrap;font-size:10.5px;color:var(--dim);background:var(--panel2);
  border:1px solid var(--line);border-left:none;border-radius:0}
.rc .drvlane .dcell:first-child{border-left:1px solid var(--line);border-radius:6px 0 0 6px}
.rc .drvlane .dcell:last-of-type{border-radius:0 6px 6px 0}
.rc .drvlane .dcell span{overflow:hidden;text-overflow:ellipsis;padding:0 6px;letter-spacing:.02em}
.rc .drvlane .dcell.cur{color:var(--txt);border-color:var(--teal);
  background:rgba(150,0,24,.22);font-weight:600}
.rc .drvlane .dgap{background:transparent;flex:0 0 auto}
.rc .hint{color:var(--dim);font-size:11px;margin-top:6px;line-height:1.5}
.rc .warn{color:var(--yellow)}
.rc .fuelbig{font-family:'Rajdhani';font-size:52px;font-weight:700;
  color:var(--green);line-height:1;margin:6px 0}
.rc .teambar{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:8px;
  padding:10px 20px;border-bottom:1px solid var(--line);background:var(--panel)}
.rc .teambar.collapsed{padding:5px 20px}
.rc .bartoggle{background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--dim);cursor:pointer;padding:2px 12px;font-size:11px;line-height:1.4;
  font-family:'IBM Plex Mono'}
.rc .bartoggle:hover{color:var(--txt);border-color:var(--teal)}
.rc .teambar input{width:110px;background:var(--panel2);border:1px solid var(--line);
  border-radius:6px;color:var(--txt);padding:6px 8px;font-family:'IBM Plex Mono';
  font-size:12px;text-transform:uppercase}
.rc .teambar button{padding:6px 12px;border-radius:6px;border:1px solid var(--teal);
  background:transparent;color:var(--teal);cursor:pointer;font-family:'Rajdhani';
  font-size:14px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.rc .teambar button.solid{background:var(--car);color:#FFE9ED}
.rc .teambar button.leave{border-color:var(--red);color:var(--red)}
.rc .dot{width:9px;height:9px;border-radius:99px;display:inline-block}
.rc .dot.on{background:var(--green);box-shadow:0 0 6px var(--green)}
.rc .dot.off{background:var(--dim)}
.rc .roomcode{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:17px;
  color:var(--yellow);letter-spacing:.02em}
.rc .syncinfo{color:var(--dim);font-size:11px;margin-left:auto}
/* --- lobi --- */
.rc .lobby{min-height:100vh;display:flex;align-items:center;justify-content:center;
  padding:20px;background:radial-gradient(ellipse at 50% 0%,#2A0D14 0%,var(--bg) 60%)}
.rc .logo{display:block;margin:0 auto 14px;max-width:280px;width:70%;height:auto;
  filter:drop-shadow(0 6px 18px rgba(0,0,0,.5))}
.rc header img.hlogo{height:38px;width:auto;display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
.rc .pitboard img.plogo{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
  height:34px;width:auto;opacity:.85}
.rc .lobby .box{width:100%;max-width:430px;background:var(--panel);
  border:1px solid var(--line);border-radius:14px;padding:30px 28px}
.rc .lobby h1{margin:0;font-size:30px;font-weight:700;text-transform:uppercase;
  text-align:center;font-family:'Rajdhani';letter-spacing:.04em}
.rc .lobby h1 b{color:var(--teal)}
.rc .lobby .sub{text-align:center;color:var(--dim);font-size:12px;margin:4px 0 22px}
.rc .lobby .bigbtn{width:100%;padding:12px;border-radius:8px;border:1px solid var(--teal);
  background:var(--car);color:#FFE9ED;cursor:pointer;font-family:'Rajdhani';
  font-size:18px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-top:8px}
.rc .lobby .bigbtn.ghost{background:transparent;color:var(--teal);border-color:var(--teal)}
.rc .lobby .bigbtn:disabled{opacity:.5;cursor:wait}
.rc .lobby .divider{display:flex;align-items:center;gap:10px;color:var(--dim);
  margin:20px 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:.12em}
.rc .lobby .divider::before,.rc .lobby .divider::after{
  content:"";flex:1;height:1px;background:var(--line)}
.rc .lobby .solo{display:block;width:100%;margin-top:22px;background:none;border:none;
  color:var(--dim);cursor:pointer;font-size:12px;text-decoration:underline;
  text-underline-offset:3px}
.rc .lobby .solo:hover{color:var(--txt)}
.rc .lobby .lmsg{margin-top:12px;color:var(--yellow);font-size:12px;text-align:center;
  min-height:16px}
/* --- pist & araç seçimi --- */
.rc .picksec{margin-top:18px}
.rc .picksec h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;
  letter-spacing:.08em;color:var(--dim);font-family:'Rajdhani';font-size:15px}
.rc .trackgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.rc .trackgrid button{display:flex;align-items:center;gap:8px;padding:9px 10px;
  border-radius:8px;border:1px solid var(--line);background:var(--panel2);
  color:var(--txt);cursor:pointer;font-size:12px;text-align:left}
.rc .trackgrid button img{width:22px;height:auto;border-radius:2px;flex-shrink:0}
.rc .trackgrid button.on{border-color:var(--teal);background:rgba(150,0,24,.25);
  color:var(--teal);font-weight:600}
.rc .classtoggle{display:flex;gap:8px}
.rc .wxsel{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:4px 0 2px}
.rc .wxsel button{padding:6px 2px;border:1px solid var(--line);border-radius:8px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:11px;line-height:1.3;
  text-align:center;transition:border-color .15s,color .15s}
.rc .wxsel button small{font-family:'IBM Plex Mono',monospace;opacity:.8;font-size:10px}
.rc .wxsel button.on{background:rgba(255,255,255,.05)}
.rc .minibtn{width:22px;height:22px;padding:0;border:1px solid var(--line);border-radius:6px;
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:13px;line-height:1}
.rc .minibtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .histbtn{border:1px solid var(--line);border-radius:8px;background:var(--panel2);
  color:var(--txt);cursor:pointer;font-size:12px;padding:5px 12px;transition:border-color .15s}
.rc .histbtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .gbtn{display:inline-flex;align-items:center;gap:10px;margin:0 auto;padding:11px 22px;
  border:1px solid var(--line);border-radius:10px;background:#fff;color:#1f1f1f;
  font-family:'Rajdhani';font-size:16px;letter-spacing:.04em;text-transform:uppercase;
  font-weight:600;cursor:pointer;transition:box-shadow .18s,transform .12s}
.rc .gbtn:hover{box-shadow:0 6px 20px rgba(0,0,0,.45);transform:translateY(-1px)}
.rc .gbtn:active{transform:scale(.98)}
.rc .adminbtn{position:relative;align-self:center;display:inline-flex;align-items:center;gap:5px;
  background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--txt);
  cursor:pointer;font-size:12px;padding:5px 11px}
.rc .adminbtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .adminbtn .badge{position:absolute;top:-6px;right:-6px;background:var(--car);color:#fff;
  border-radius:9px;font-size:10px;padding:1px 6px;line-height:1.4}
.rc .lobbyteams{margin-bottom:14px;text-align:left}
.rc .lrace{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;
  transition:border-color .15s,transform .12s;text-align:left}
.rc .lrace:hover{border-color:var(--teal);transform:translateX(2px)}
.rc .lrace.next{border-color:var(--car);background:rgba(150,0,24,.14)}
.rc .lrace .lrtrack{width:54px;height:34px;object-fit:contain;opacity:.85;flex:0 0 auto}
.rc .lrace .lrinfo{display:flex;flex-direction:column;flex:1;min-width:0;gap:1px}
.rc .lrace .lrinfo b{font-size:13px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .lrace .lrmeta{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .lrace .lrdate{font-size:10.5px;color:var(--teal);letter-spacing:.03em}
.rc .tmroom .rmeta{display:block;font-size:10.5px;color:var(--dim);font-weight:400}
.rc .lroom{display:flex;align-items:center;gap:9px;width:100%;padding:10px 12px;margin-bottom:6px;
  border:1px solid var(--line);border-radius:10px;background:var(--panel2);cursor:pointer;
  transition:border-color .15s,transform .12s}
.rc .lroom:hover{border-color:var(--teal);transform:translateX(2px)}
.rc .lroom .rcode{font-weight:700;color:var(--teal);letter-spacing:.08em;font-size:13px}
.rc .lroom .rlabel{flex:1;font-size:12px;color:var(--txt);overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;text-align:left}
.rc .lroom .rrole{font-size:9px;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;
  border-radius:5px;border:1px solid var(--line);color:var(--dim)}
.rc .lroom .rrole.ed{color:var(--green);border-color:rgba(46,204,113,.4)}
.rc .lroom .rgo{color:var(--dim);font-size:15px}
.rc .tmtabs{display:flex;gap:6px;padding:10px 14px 0;flex-wrap:wrap}
.rc .tmtabs button{padding:5px 12px;border:1px solid var(--line);border-radius:8px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px}
.rc .tmtabs button.on{border-color:var(--car);color:#FFD9E0;background:rgba(150,0,24,.22)}
.rc .tmsec{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--car);
  font-weight:700;margin:6px 0 7px}
.rc .tmroom{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:8px;
  background:rgba(255,255,255,.03);margin-bottom:5px}
.rc .tmroom .rcode{font-weight:700;color:var(--teal);letter-spacing:.08em}
.rc .tmroom .rlabel{flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc .tmroom .rpin{font-size:11px;color:var(--yellow)}
.rc .tmroom .rpin.dim{color:var(--dim)}
.rc .tmroom .ubtn{padding:4px 12px;font-size:11px}
.rc .tmadd{display:flex;gap:6px;margin-top:8px;align-items:center}
.rc .tmadd input{margin:0}
.rc .tmmem{display:flex;align-items:center;gap:9px;padding:5px 9px;font-size:12px}
.rc .tmmem .mbadges{display:inline-flex;gap:3px;flex:0 0 auto}
.rc .btgl{width:26px;height:24px;padding:0;border:1px solid var(--line);border-radius:6px;
  background:var(--panel2);color:var(--dim);cursor:pointer;font-size:12px;line-height:1;
  opacity:.5;transition:opacity .15s}
.rc .btgl.on{opacity:1}
.rc .btgl:hover{opacity:1}
.rc .tmmem .mrole{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;
  border-radius:6px;border:1px solid var(--line);color:var(--dim)}
.rc .tmmem .muid{color:var(--muted);font-size:11px}
.rc .tmfoot{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--line);
  align-items:center;flex-wrap:wrap}
.rc .tmfoot input{margin:0;flex:1;min-width:120px}
.rc .urow{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px}
.rc .urow:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .urow img,.rc .urow .uav{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto;
  background:var(--panel2);display:flex;align-items:center;justify-content:center;color:var(--dim)}
.rc .urow .uinfo{display:flex;flex-direction:column;min-width:0;flex:1}
.rc .urow .uinfo b{font-size:13px}
.rc .urow .umail{font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
.rc .urow .unote{font-size:11px;color:var(--muted);font-style:italic}
.rc .urow .ustat{font-size:10px;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;
  border-radius:6px;border:1px solid var(--line);color:var(--dim);white-space:nowrap}
.rc .urow .ustat.ok{color:var(--green);border-color:rgba(46,204,113,.4)}
.rc .urow .ustat.wait{color:var(--yellow);border-color:rgba(242,201,76,.4)}
.rc .urow .ubtn{padding:5px 14px;font-size:12px;background:var(--green);color:#04240F;border:none}
.rc .userchip{display:inline-flex;align-items:center;gap:7px;align-self:center;
  background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:3px 5px 3px 3px}
.rc .userchip img{width:24px;height:24px;border-radius:50%;object-fit:cover}
.rc .ubadge{font-size:12px;line-height:1;padding:3px 6px;border-radius:6px;border:1px solid}
.rc .bchip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
  padding:5px 12px;border-radius:8px;border:1px solid;margin-bottom:14px;letter-spacing:.03em}
.rc .bsel{width:auto;min-width:130px;font-size:11px;padding:3px 6px;margin:0}
.rc .userchip .unamebtn{background:none;border:none;color:var(--txt);font-size:12px;cursor:pointer;
  max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 2px}
.rc .userchip .unamebtn:hover{color:var(--teal);text-decoration:underline}
.rc .userchip .uname{font-size:12px;color:var(--txt);max-width:150px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.rc .userchip button{background:none;border:none;color:var(--dim);cursor:pointer;
  font-size:13px;padding:2px 6px;border-radius:6px}
.rc .userchip button:hover{color:var(--car);background:rgba(150,0,24,.15)}
.rc .lapcell{display:inline-flex;align-items:center;gap:4px}
.rc .lapcell b{min-width:20px;text-align:center;font-variant-numeric:tabular-nums}
.rc .lapcell b.lapman{color:var(--teal)}
.rc .lapstep{width:18px;height:18px;padding:0;border:1px solid var(--line);border-radius:5px;
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:12px;line-height:1}
.rc .lapstep:hover:not(:disabled){border-color:var(--teal);color:var(--teal)}
.rc .lapstep:disabled{opacity:.3;cursor:not-allowed}
.rc .lapclr{width:16px;height:16px;padding:0;border:none;border-radius:4px;
  background:transparent;color:var(--dim);cursor:pointer;font-size:11px}
.rc .lapclr:hover{color:var(--car)}
.rc .wxmodal{position:fixed;inset:0;z-index:1000;background:rgba(10,6,10,.72);
  backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;
  padding:20px;animation:lbfade .18s ease}
.rc .wxmbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  width:min(440px,94vw);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;
  animation:lbzoom .26s cubic-bezier(.2,.85,.3,1.12)}
.rc .wxmhead{display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid var(--line);font-family:'Rajdhani';
  font-size:18px;letter-spacing:.04em;text-transform:uppercase}
/* tur listesi penceresi: pilot sütunu için biraz geniş */
.rc .wxmbox.laps{width:min(520px,94vw)}
/* pist haritası penceresi: kare harita için geniş varyant (⛶ Büyüt) */
.rc .wxmbox.map{width:auto;max-width:96vw;max-height:94vh}
.rc .wxmbox.map .mapwrap{display:flex;justify-content:center;padding:10px}
.rc .wxmbox.map .mapwrap svg{width:min(88vw,78vh);height:auto}
.rc .wxmlist{overflow:auto;padding:8px}
.rc .wxrow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px}
.rc .wxrow:nth-child(odd){background:rgba(255,255,255,.03)}
.rc .wxrow .wxdot{width:11px;height:11px;border-radius:3px;flex:0 0 auto}
.rc .wxrow .wxnm{font-weight:600;min-width:96px}
.rc .wxrow .wxml{color:var(--dim);font-size:12px}
.rc .wxrow .wxat{margin-left:auto;color:var(--muted);font-size:12px}
.rc .wxmfoot{padding:10px 16px;border-top:1px solid var(--line);display:flex;
  justify-content:flex-end}
.rc .wxsrc{font-size:9px;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;
  border-radius:5px;border:1px solid}
.rc .wxsrc.live{color:var(--teal);border-color:rgba(210,67,87,.42);background:rgba(210,67,87,.12)}
.rc .wxsrc.plan{color:#c9a227;border-color:rgba(201,162,39,.4);background:rgba(201,162,39,.1)}
.rc .wxrow .wxat{margin-left:auto}
.rc .wxmplan{padding:10px 16px;border-top:1px solid var(--line)}
.rc .wxmptitle{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim);
  margin-bottom:7px}
.rc .wxmprow{display:flex;gap:6px;align-items:center}
.rc .wxmprow select{flex:1}
.rc .wxmprow input{width:90px;text-align:center}
.rc .wxmquick{display:flex;gap:6px;margin-top:7px}
.rc .wxbar{position:relative;display:flex;height:16px;margin-top:4px;border-radius:6px;
  overflow:hidden;border:1px solid var(--line)}
.rc .wxbar .wseg{position:relative;min-width:2px;display:flex;align-items:center;
  justify-content:center;font-size:9px;transition:width .4s ease}
.rc .wxbar .wseg span{opacity:.85;filter:drop-shadow(0 0 1px rgba(0,0,0,.5))}
.rc .wxbar .wseg.rain::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(115deg,rgba(255,255,255,.22) 0 2px,
    transparent 2px 9px);background-size:200% 100%;animation:wxrain 1.1s linear infinite}
@keyframes wxrain{from{background-position:0 0}to{background-position:-36px 0}}
.rc .classtoggle button{flex:1;display:flex;align-items:center;justify-content:center;
  gap:8px;padding:10px;border-radius:8px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);cursor:pointer;
  font-family:'Rajdhani';font-size:16px;font-weight:600;letter-spacing:.05em}
.rc .classtoggle button img{width:26px;height:auto}
.rc .classtoggle button.on{border-color:var(--teal);background:rgba(150,0,24,.25);
  color:var(--teal)}
.rc .cargrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.rc .cargrid button{padding:10px 10px 8px;border-radius:10px;border:1px solid var(--line);
  background:var(--panel2);cursor:pointer;color:var(--dim);font-size:11.5px}
.rc .cargrid button img{width:100%;height:auto;margin-bottom:6px;
  filter:drop-shadow(0 4px 8px rgba(0,0,0,.45))}
.rc .cargrid button.on{border-color:var(--teal);background:rgba(150,0,24,.20);
  color:var(--txt);font-weight:600}
.rc .lteam{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;
  color:var(--txt);padding:8px 10px;margin-bottom:10px;border-radius:8px;
  background:var(--panel2);border:1px solid var(--line)}
.rc .lseason{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--dim);margin:10px 0 4px 2px;display:flex;align-items:center;gap:8px}
.rc .lseason::after{content:"";flex:1;height:1px;background:var(--line)}
.rc .floatstream{position:fixed;z-index:900;width:320px;background:var(--panel);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;
  box-shadow:0 10px 34px rgba(0,0,0,.55)}
.rc .floatstream.br{right:16px;bottom:16px}
.rc .floatstream.bl{left:16px;bottom:16px}
.rc .floatstream.tr{right:16px;top:110px}
.rc .floatstream.tl{left:16px;top:110px}
.rc .floatstream .fshead{display:flex;align-items:center;gap:6px;
  padding:5px 8px;background:var(--panel2);border-bottom:1px solid var(--line)}
.rc .floatstream .fsgrip{cursor:nwse-resize;color:var(--dim);font-size:12px;
  padding:0 2px;user-select:none;touch-action:none}
.rc .floatstream .fsgrip:hover{color:var(--teal)}
.rc .floatstream .fsshield{position:absolute;inset:0;z-index:2}
.rc .floatstream .fstitle{font-size:10.5px;letter-spacing:.1em;color:var(--muted);
  font-family:'Rajdhani',sans-serif;margin-right:auto}
.rc .floatstream .fsbtns{display:flex;gap:2px;align-items:center}
.rc .floatstream .fsbtns button,.rc .floatstream .fsbtns a{background:none;border:0;
  color:var(--dim);cursor:pointer;font-size:11px;padding:1px 4px;line-height:1;
  text-decoration:none}
.rc .floatstream .fsbtns button:hover,.rc .floatstream .fsbtns a:hover{color:var(--teal)}
.rc .floatstream .fsbtns button.on{color:var(--red)}
.rc .floatstream .fsbody{aspect-ratio:16/9;background:#000;position:relative}
.rc .floatstream .fsbody iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.rc .floatstream.min{width:210px}
.rc .floatstream.min .fsbody{display:none}
.rc .tourbtn{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
  border-radius:6px;border:1px solid var(--line);background:var(--panel2);
  color:var(--muted);font-size:11.5px;cursor:pointer;transition:.15s;
  align-self:center;white-space:nowrap}
.rc .tourbtn:hover{border-color:var(--teal);color:var(--teal)}
.rc .tourwrap{position:fixed;inset:0;z-index:3000}
.rc .tourdim{position:absolute;inset:0;background:rgba(8,4,8,.78)}
.rc .tourhole{position:absolute;border-radius:12px;
  box-shadow:0 0 0 9999px rgba(8,4,8,.78), 0 0 0 2px var(--red),
    0 0 22px rgba(150,0,24,.55);transition:all .28s ease;pointer-events:none}
.rc .tourcard{position:absolute;background:var(--panel);border:1px solid var(--red);
  border-radius:12px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.6);
  transition:all .28s ease}
.rc .tourcard h3{margin:0 0 6px;font-size:15px;color:var(--red);
  font-family:'Rajdhani',sans-serif;letter-spacing:.04em}
.rc .tourcard p{margin:0 0 12px;font-size:12.5px;line-height:1.55;color:var(--txt)}
.rc .tourstep{font-size:10px;color:var(--dim);letter-spacing:.14em;margin-bottom:4px}
.rc .tourbtns{display:flex;gap:8px;align-items:center}
.rc .chattabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid var(--line);
  overflow-x:auto}
.rc .ctab{position:relative;background:none;border:1px solid var(--line);border-bottom:0;
  border-radius:8px 8px 0 0;color:var(--dim);font-size:11.5px;padding:6px 12px;
  cursor:pointer;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.rc .ctab.on{color:var(--red);border-color:var(--red);background:var(--panel2)}
.rc .ctab .cdot{position:absolute;top:1px;right:2px;background:var(--red);color:#fff;
  border-radius:8px;font-size:9px;padding:0 4px;line-height:13px}
.rc .chatwrap{display:flex;flex-direction:column;height:min(62vh,460px)}
.rc .chatlist{flex:1;overflow-y:auto;padding:10px 14px;display:flex;
  flex-direction:column;gap:9px}
.rc .cmsg{max-width:78%;align-self:flex-start}
.rc .cmsg.me{align-self:flex-end}
.rc .cmsg .who{font-size:10.5px;color:var(--dim);margin:0 0 2px 2px;
  display:flex;gap:6px;align-items:center}
.rc .cmsg.me .who{justify-content:flex-end;margin:0 2px 2px 0}
.rc .cmsg .bub{background:var(--panel2);border:1px solid var(--line);
  border-radius:12px;padding:7px 11px;font-size:13px;line-height:1.45;
  white-space:pre-wrap;word-break:break-word}
.rc .cmsg.me .bub{background:rgba(150,0,24,.22);border-color:rgba(150,0,24,.55)}
.rc .cmsg .del{background:none;border:0;color:var(--dim);cursor:pointer;
  font-size:10px;padding:0 2px;opacity:0;transition:.15s}
.rc .cmsg:hover .del{opacity:1}
.rc .cmsg .del:hover{color:var(--red)}
.rc .chatbar{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--line)}
.rc .chatbar input{flex:1;margin:0;text-transform:none;letter-spacing:0}
.rc .chatday{align-self:center;font-size:10px;color:var(--dim);
  border:1px solid var(--line);border-radius:10px;padding:1px 9px}
.rc .infobtn{position:relative;width:26px;height:26px;flex:0 0 26px;padding:0;
  border-radius:50%;border:1px solid var(--line);background:var(--panel2);
  color:var(--muted);font:700 14px/1 Georgia,serif;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;transition:.15s}
.rc .infobtn:hover{border-color:var(--red);color:var(--red)}
.rc .infobtn .nd{position:absolute;top:-2px;right:-2px;width:8px;height:8px;
  border-radius:50%;background:var(--red);border:1px solid var(--panel)}
.rc .clgv{padding:12px 16px 4px;border-top:1px solid var(--line)}
.rc .clgv:first-child{border-top:0}
.rc .clgv h4{margin:0 0 2px;font-size:14px;letter-spacing:.04em}
.rc .clgv h4 .cur{margin-left:8px;font-size:10px;padding:1px 6px;border-radius:4px;
  border:1px solid var(--red);color:var(--red);letter-spacing:.08em;vertical-align:2px}
.rc .clgv .cdate{color:var(--dim);font-size:11px;margin-bottom:8px}
.rc .clgv ul{margin:0 0 10px;padding-left:18px}
.rc .clgv li{font-size:12.5px;line-height:1.55;color:var(--txt);margin-bottom:4px}
.rc .langsw{display:inline-flex;gap:4px;margin-left:auto;align-self:center}
.rc .langsw button{padding:3px 9px;border-radius:5px;border:1px solid var(--line);
  background:var(--panel2);color:var(--dim);font-size:11px;cursor:pointer;font-weight:600}
.rc .langsw button.on{border-color:var(--teal);color:var(--teal)}
.rc .hdsel{display:inline-flex;align-items:center;gap:7px;color:var(--dim);font-size:12px;align-self:center}
.rc .hdsel img.flag{width:18px;height:auto;border-radius:2px}
.rc .hdsel img.car{height:22px;width:auto}
/* viewer (yarışta): girişler pasif kalır — her tuş/seçimde toast spam'ı olmasın. */
.rc .viewonly input,.rc .viewonly select,.rc .viewonly textarea,
.rc .viewonly input[type=file],.rc .viewonly input[type=checkbox]{pointer-events:none;opacity:.55}
/* viewer: düzenleme DÜĞMELERİ soluk ama TIKLANABİLİR kalır → tık edit() muhafızına ulaşır
   ve "yetkiniz yok" kutucuğunu tetikler; salt-okunur .card .act eylemleri (+, ⛶) de erişilir. */
.rc .viewonly .strat button,.rc .viewonly .tyrebox button,
.rc .viewonly .pitopt button,.rc .viewonly .card .act{pointer-events:auto;opacity:.55}
.rc .viewonly .tabs button{pointer-events:auto;opacity:1}
/* Yetki reddi kutucuğu (DenyToast) — alt-orta, kırmızı kenar, kayarak belirir. */
.rc .denytoast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:1200;
  display:flex;align-items:center;gap:10px;max-width:min(520px,92vw);
  padding:12px 18px;border-radius:12px;background:var(--panel);border:1px solid var(--red);
  box-shadow:0 12px 34px rgba(150,0,24,.34),inset 0 0 0 1px rgba(255,77,94,.16);
  color:var(--txt);font-size:14px;font-weight:600;line-height:1.35;
  animation:dtin .28s cubic-bezier(.2,.85,.3,1.12)}
.rc .denytoast .dticon{font-size:18px;flex:0 0 auto}
@keyframes dtin{from{opacity:0;transform:translate(-50%,14px) scale(.96)}
  to{opacity:1;transform:translate(-50%,0) scale(1)}}
@media (prefers-reduced-motion:reduce){.rc .denytoast{animation:none}}
.rc textarea:focus{outline:2px solid var(--teal)}
.rc select{background:var(--panel2);border:1px solid var(--line);border-radius:6px;
  color:var(--txt);padding:5px 6px;font-family:'IBM Plex Mono';font-size:12px}
.rc .tin{width:56px!important;text-align:center}
.rc .drvsel{min-width:96px;max-width:120px;padding:4px 6px}
.rc .tsel{width:76px;text-align:center;background:transparent!important}
.rc td.tcarry .tsel{color:var(--dim);font-style:italic;opacity:.75}
.rc td.terr{background:rgba(240,96,77,.18);outline:2px solid var(--red);outline-offset:-2px}
.rc td.t2{background:rgba(242,201,76,.22)}
.rc td.tq{background:rgba(102,148,255,.25)}
.rc td.t3{background:rgba(232,132,42,.30)}
.rc td.t4{background:rgba(220,38,38,.42)}
.rc td.tw{background:rgba(127,227,160,.22)}
.rc td.t4 input{color:var(--red);border-color:var(--red)}
.rc .act{padding:6px 12px;border-radius:6px;border:1px solid var(--line);
  background:var(--panel2);color:var(--txt);cursor:pointer;font-size:12px}
.rc .act.danger{border-color:var(--red);color:var(--red)}
.rc .rchip{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;
  border-radius:99px;border:1px solid var(--line);background:var(--panel2);
  margin:0 6px 6px 0;font-size:12px}
.rc .rchip b{cursor:pointer;color:var(--red)}
.rc .legend{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:var(--dim)}
.rc .legend i{display:inline-block;width:12px;height:12px;border-radius:3px;
  margin-right:4px;vertical-align:-2px;border:1px solid var(--line)}
/* --- code 80 sarı efekt --- */
.rc .card.c80{border-color:rgba(242,201,76,.55);
  box-shadow:0 0 0 1px rgba(242,201,76,.18),0 0 26px rgba(242,201,76,.08)}
.rc .card.c80 h2{color:var(--yellow)}
.rc .card.c80 .kpi{border-color:rgba(242,201,76,.30)}
.rc .tabs button.on.c80t{border-color:var(--yellow);color:var(--yellow)}
/* --- canlı mod --- */
.rc .livestrip{display:flex;flex-wrap:wrap;align-items:center;gap:16px;
  padding:8px 20px;border-bottom:1px solid var(--line);background:#210B10}
.rc .livestrip .big{font-family:'Rajdhani';font-size:22px;font-weight:700}
.rc .livestrip .lbl{color:var(--dim);font-size:10px;text-transform:uppercase;
  letter-spacing:.07em;display:block}
@keyframes rcpulse{0%,100%{opacity:1}50%{opacity:.35}}
.rc .pulse{animation:rcpulse 1.1s ease-in-out infinite;color:var(--yellow)}
@media (prefers-reduced-motion: reduce){.rc .pulse{animation:none}}
.rc .timeline{position:relative}
.rc .nowline{position:absolute;top:-4px;bottom:-4px;width:2px;background:#fff;
  box-shadow:0 0 8px #fff;z-index:2}
.rc tr.live td{background:rgba(150,0,24,.16);border-left:3px solid var(--teal)}
.rc tr.pitsoon td{background:rgba(242,201,76,.12)}
/* --- canlı timing rozeti --- */
.rc .livebadge{display:inline-flex;align-items:center;gap:6px;font-size:11px;
  font-family:'IBM Plex Mono';letter-spacing:.04em;padding:2px 9px;border-radius:99px;
  border:1px solid var(--line);text-transform:uppercase}
.rc .livebadge i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.rc .livebadge.on{color:var(--green);border-color:rgba(55,214,122,.5)}
.rc .livebadge.on i{background:var(--green);box-shadow:0 0 8px var(--green);
  animation:rcpulse 1.2s ease-in-out infinite}
.rc .livebadge.lag{color:var(--yellow);border-color:rgba(245,178,61,.5)}
.rc .livebadge.lag i{background:var(--yellow)}
.rc .livebadge.off{color:var(--muted)}
.rc .livebadge.off i{background:var(--muted)}
/* --- büyük pano (pit duvarı / tam ekran) — uzaktan okunur --- */
.rc .bigboard{background:var(--bg);overflow:auto;padding:16px}
.rc .bigboard .card{margin-bottom:14px}
.rc .bigboard h2{font-size:22px}
.rc .bigboard table{font-size:19px}
.rc .bigboard td,.rc .bigboard th{padding:9px 12px}
.rc .bigboard .disp{font-size:22px}
.rc .bigboard .hint{display:none}
/* --- masaüstü (Tauri) güncelleme şeridi --- */
.rc .updatebar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:8px 20px;background:linear-gradient(90deg,rgba(150,0,24,.35),rgba(150,0,24,.12));
  border-bottom:1px solid var(--line);color:var(--txt);font-size:12.5px}
.rc .updatebar .act{padding:5px 14px;font-size:12px}
/* --- HUD şeridi (canlı mod kokpit) --- */
.rc .hudstrip{display:flex;flex-wrap:wrap;align-items:center;gap:18px;
  padding:12px 20px;border-bottom:1px solid var(--line);
  background:radial-gradient(130% 180% at 100% 0,rgba(150,0,24,.22),#1E0A0E 62%)}
.rc .hudstrip .hcell{display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0}
.rc .hudstrip .lbl{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.07em}
.rc .hudstrip .hclock{font-family:'Rajdhani';font-weight:700;font-variant-numeric:tabular-nums;
  font-size:clamp(30px,5vw,48px);line-height:.95;color:var(--green);
  text-shadow:0 0 20px rgba(55,214,122,.28)}
.rc .hudstrip .hbar{height:4px;border-radius:3px;background:var(--panel2);overflow:hidden;
  margin-top:5px;min-width:150px}
.rc .hudstrip .hbar i{display:block;height:100%;border-radius:3px;
  background:linear-gradient(90deg,var(--car),var(--teal))}
.rc .hudstrip .hstint{font-family:'Rajdhani';font-weight:700;font-size:30px;line-height:1;
  letter-spacing:.02em}
.rc .hudstrip .hdrv{color:var(--teal);font-weight:600;font-size:14px}
.rc .hudstrip .hgauge{align-items:center;gap:4px}
.rc .hudstrip .hudpit{margin-left:auto;align-self:center}
@media(max-width:720px){.rc .hudstrip{gap:12px}.rc .hudstrip .hudpit{margin-left:0}}
/* --- pit board --- */
.rc .pitboard{position:fixed;inset:0;z-index:50;
  background:radial-gradient(1100px 550px at 50% -12%,#2E0C15 0%,#06040A 64%);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3vh;text-align:center;padding:4vh 4vw}
.rc .pitboard .huge{font-family:'Rajdhani';font-weight:700;
  font-size:clamp(70px,18vw,220px);line-height:.95;color:var(--green);
  font-variant-numeric:tabular-nums}
.rc .pitboard .mid{font-family:'Rajdhani';font-weight:600;
  font-size:clamp(28px,6vw,64px);color:var(--txt)}
.rc .pitboard .plbl{color:var(--dim);font-size:clamp(12px,2vw,18px);
  text-transform:uppercase;letter-spacing:.15em}
.rc .pitboard .close{position:absolute;top:16px;right:20px;font-size:26px;
  background:none;border:1px solid var(--line);border-radius:8px;color:var(--dim);
  width:44px;height:44px;cursor:pointer}
.rc .pbrow{display:flex;gap:1.6vw;flex-wrap:wrap;justify-content:center;align-items:center}
.rc .pitboard .pbcard.pbgauge{display:flex;flex-direction:column;align-items:center;gap:8px;
  background:none;border:none;padding:0;min-width:150px}
.rc .pitboard .pbcard.pbgauge svg{filter:drop-shadow(0 6px 22px rgba(0,0,0,.5))}
.rc .pitboard .pbcard{background:rgba(255,255,255,.035);border:1px solid var(--line);
  border-radius:16px;padding:1.4vh 2.6vw;min-width:170px}
.rc .pitboard .chips{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;
  align-items:center}
.rc .pitboard .chip2{font-family:'Rajdhani';font-weight:700;letter-spacing:.08em;
  padding:5px 16px;border-radius:9px;font-size:clamp(15px,2.4vw,22px);line-height:1;
  border:1px solid}
.rc .pitboard .chip2.fuel{color:var(--green);border-color:var(--green);
  background:rgba(46,204,113,.12)}
.rc .pitboard .chip2.tyre{color:var(--teal);border-color:var(--teal);
  background:rgba(210,67,87,.12)}
.rc .pitboard .chip2.none{color:var(--dim);border-color:var(--line);
  background:rgba(255,255,255,.03)}
/* --- dashboard --- */
.rc .dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.rc .infocard{text-align:center}
.rc .infocard .disp{justify-content:center}
.rc .infocard .hint{text-align:center}
/* tıklanabilir kart + büyütme (lightbox) animasyonları */
.rc .infocard.clickable{cursor:zoom-in;transition:transform .18s ease,border-color .18s ease,
  box-shadow .18s ease}
.rc .infocard.clickable:hover{transform:translateY(-3px) scale(1.02);border-color:var(--teal);
  box-shadow:0 8px 24px rgba(0,0,0,.45)}
.rc .infocard.clickable:active{transform:scale(.98)}
.rc .lightbox{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:14px;padding:32px;cursor:zoom-out;
  background:rgba(10,6,10,.88);backdrop-filter:blur(5px);animation:lbfade .22s ease}
.rc .lightbox img{max-width:90vw;max-height:78vh;object-fit:contain;
  animation:lbzoom .3s cubic-bezier(.2,.85,.3,1.12);
  filter:drop-shadow(0 16px 48px rgba(0,0,0,.75))}
.rc .lightbox .lbcap{font-family:'Rajdhani';font-size:20px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--txt);animation:lbfade .4s ease}
.rc .lightbox .lbclose{position:absolute;top:18px;right:22px;background:var(--panel2);
  border:1px solid var(--line);border-radius:8px;color:var(--txt);font-size:16px;
  padding:6px 12px;cursor:pointer}
.rc .lightbox .lbclose:hover{border-color:var(--car);color:#FFE9ED}
@keyframes lbfade{from{opacity:0}to{opacity:1}}
@keyframes lbzoom{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
/* lightbox tempo kademeleri paneli */
.rc .lbtiers{background:var(--panel2);border:1px solid var(--line);border-radius:12px;
  padding:12px 18px;min-width:320px;cursor:default;animation:lbzoom .3s cubic-bezier(.2,.85,.3,1.12)}
.rc .lbtr{display:flex;align-items:center;gap:10px;padding:3px 0;font-size:13px}
.rc .lbtr i{width:10px;height:10px;border-radius:3px;flex:0 0 auto}
.rc .lbtr .lbl{flex:1;letter-spacing:.06em;font-size:11px;color:var(--muted);
  text-transform:uppercase}
.rc .lbtr b{font-size:14px}
.rc .lbtr:first-child .lbl{color:var(--txt);font-weight:700}
.rc .lbtr:first-child{border-bottom:1px solid var(--line);padding-bottom:6px;margin-bottom:4px}
.rc .lbsrc{margin-top:8px;padding-top:6px;border-top:1px solid var(--line);font-size:9.5px;
  color:var(--muted);letter-spacing:.04em}
/* ============================================================
   RTÖTUŞ — ergonomi + cila (muhafazakar; yalnız görsel)
   ============================================================ */
/* sayısal hizalama + biraz daha okunur tablo gövdesi */
.rc td,.rc .mono{font-variant-numeric:tabular-nums}
.rc td{font-size:13px}
/* veri tablolarında satır-hover (yoğun tabloyu taramak kolaylaşır) */
.rc tbody tr{transition:background .12s}
.rc tbody tr:hover td{background:rgba(255,255,255,.035)}
.rc tbody tr.last:hover td,.rc tbody tr.live:hover td{background:rgba(255,255,255,.06)}
/* KPI: üst-kenar vurgu (hafif derinlik + hiyerarşi) */
.rc .kpi{position:relative;overflow:hidden}
.rc .kpi::before{content:"";position:absolute;left:10px;right:10px;top:0;height:2px;
  border-radius:2px;background:linear-gradient(90deg,var(--accent),transparent 72%);opacity:.6}
/* dokunma hedeflerini büyüt (fare) */
.rc .tyrebox button{width:30px;height:28px;font-size:10px}
.rc .lapstep{width:22px;height:22px}
.rc .lapclr{width:20px;height:20px;font-size:12px}
.rc .minibtn{width:24px;height:24px}
.rc .pitopt button{padding:4px 10px}
/* dokunmatik cihazlarda biraz daha büyük — masaüstü etkilenmez */
@media (pointer:coarse){
  .rc .tyrebox button{width:36px;height:32px}
  .rc .lapstep{width:26px;height:26px}
  .rc .pitopt button{padding:7px 12px}
  .rc .lapclr{width:24px;height:24px}
}
/* klavye odağı her interaktif öğede görünür */
.rc button:focus-visible,.rc select:focus-visible,.rc a:focus-visible,
.rc [role="button"]:focus-visible{outline:2px solid var(--accent);outline-offset:2px;
  border-radius:6px}
`;

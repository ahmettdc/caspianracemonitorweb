"""Kalıcı dosya-log — sürüş PC'sinde köprünün sağlığını GÖRMEK ve PAYLAŞMAK için.
(TinyPedal `log_handler` deseni: zaman damgalı satırlar, döngüsel dosya.)

Neden: köprü bugüne dek yalnız stderr / GUI içi log kutusuna yazıyordu → kapanınca
kayboluyordu, sürücü bir sorunda paylaşacak bir şey bulamıyordu. Bu modül köprünün
her koşuşunu garanti-yazılabilir bir dosyaya döker (kare gönderimi, gecikme, hatalar)
→ hem sürücü hem biz köprünün sağlıklı çalıştığını (ve WebView2 olmadığından oyunu
dondurmadığını) doğrulayabiliriz."""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

_APP_DIR = "CaspianLiveBridge"
_LOG_NAME = "caspian-bridge.log"
_logger = None
_dir = None


def log_dir():
    """Garanti yazılabilir dizin: %LOCALAPPDATA%\\CaspianLiveBridge (Windows);
    yedek sırası: exe/script klasörü → kullanıcı home → çalışma dizini. exe Program
    Files gibi salt-okunur bir yerde olsa da log her koşulda yazılabilsin."""
    global _dir
    if _dir is not None:
        return _dir
    cands = []
    local = os.environ.get("LOCALAPPDATA")
    if local:
        cands.append(os.path.join(local, _APP_DIR))
    try:
        base = os.path.dirname(
            sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__)
        )
        cands.append(base)
    except Exception:  # noqa: BLE001
        pass
    cands.append(os.path.join(os.path.expanduser("~"), _APP_DIR))
    cands.append(os.getcwd())
    for d in cands:
        try:
            os.makedirs(d, exist_ok=True)
            probe = os.path.join(d, ".caspianwtest")
            with open(probe, "w", encoding="utf-8") as f:
                f.write("")
            os.remove(probe)
            _dir = d
            return d
        except Exception:  # noqa: BLE001
            continue
    _dir = os.getcwd()
    return _dir


def log_path():
    return os.path.join(log_dir(), _LOG_NAME)


def get_logger():
    """Tek (singleton) döngüsel dosya-logger. Handler kurulamazsa (izin yok) yine
    çalışan ama sessiz bir logger döner — köprü asla log yüzünden çökmez."""
    global _logger
    if _logger is not None:
        return _logger
    lg = logging.getLogger("caspian-bridge")
    lg.setLevel(logging.INFO)
    lg.propagate = False
    if not lg.handlers:
        try:
            fh = RotatingFileHandler(
                log_path(), maxBytes=1_000_000, backupCount=3, encoding="utf-8"
            )
            fh.setFormatter(
                logging.Formatter("%(asctime)s %(levelname)s: %(message)s", "%Y-%m-%d %H:%M:%S")
            )
            lg.addHandler(fh)
        except Exception:  # noqa: BLE001
            pass
    _logger = lg
    return lg


def heartbeat_line(sent, cars, fuel, read_ms=None, write_ms=None):
    """Köprü sağlık satırı — GUI ve CLI aynı biçimi yazsın diye tek yerde."""
    parts = [f"gönderim={sent}", f"araç={cars}", f"yakıt={fuel if fuel is not None else '—'}"]
    if read_ms is not None:
        parts.append(f"okuma={read_ms:.0f}ms")
    if write_ms is not None:
        parts.append(f"yazma={write_ms:.0f}ms")
    return "● " + " · ".join(parts)

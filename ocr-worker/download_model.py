"""Download OpenThai2.1-OCR-Text-20261118 pinned to revision v2.1.4 into ocr-worker/model."""

from pathlib import Path
import sys

from huggingface_hub import snapshot_download

REPO_ID = "iapp/OpenThai2.1-OCR-Text-20261118"
REVISION = "v2.1.4"
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"


def main() -> int:
    print(f"Downloading {REPO_ID} (revision={REVISION}) to {MODEL_DIR} ...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = snapshot_download(
        repo_id=REPO_ID,
        revision=REVISION,
        local_dir=str(MODEL_DIR),
    )
    print(f"Downloaded successfully to {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

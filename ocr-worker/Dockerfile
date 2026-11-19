FROM python:3.12-slim-bookworm

RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OCR_HOST=0.0.0.0 \
    OCR_PORT=8001 \
    OCR_THREADS=1

WORKDIR /app

COPY constraints.txt download_model.py ./
RUN pip install --no-cache-dir -c constraints.txt huggingface_hub && \
    python download_model.py && \
    cd model && sha256sum -c SHA256SUMS && cd .. && \
    rm -rf model/pytorch model/.cache && \
    pip install --no-cache-dir -c constraints.txt -r model/requirements.txt pillow && \
    pip uninstall -y huggingface_hub hf-xet httpx2 httpcore2 anyio h11 idna click tqdm fsspec filelock truststore

COPY server.py .

EXPOSE 8001

CMD ["python", "server.py"]

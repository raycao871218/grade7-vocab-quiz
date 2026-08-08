FROM node:22-trixie

WORKDIR /app

COPY get-pip.py /tmp/get-pip.py
COPY .docker-wheels /tmp/wheels
RUN python3 /tmp/get-pip.py --no-warn-script-location --break-system-packages --no-index --find-links=/tmp/wheels

COPY requirements.txt .
RUN python3 -m pip install --break-system-packages --no-cache-dir --no-index --find-links=/tmp/wheels -r requirements.txt

COPY server ./server
COPY dist ./dist

EXPOSE 8000

CMD ["python3", "-m", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]

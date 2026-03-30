FROM ghcr.io/nextlevelbuilder/goclaw:v2.44.10

# Install Python and Node.js runtimes for GoClaw skills
RUN apk add --no-cache python3 py3-pip nodejs npm && \
    pip3 install --break-system-packages --no-cache-dir \
      lxml defusedxml Pillow pypdf pdf2image pdfplumber anthropic openpyxl

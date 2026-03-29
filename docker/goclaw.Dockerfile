FROM ghcr.io/nextlevelbuilder/goclaw:latest

# Install Python and Node.js runtimes for GoClaw skills
RUN apk add --no-cache python3 py3-pip nodejs npm

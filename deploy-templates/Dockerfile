FROM node:22-slim

# Install OpenClaw CLI
RUN npm install -g openclaw

WORKDIR /app

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 18789

CMD ["./entrypoint.sh"]

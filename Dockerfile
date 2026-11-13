FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# CA bundle used to verify the RDS certificate (config/database.js).
# --chmod=644: files added from a URL are otherwise readable only by root.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem

COPY --chown=node:node . .

USER node
EXPOSE 5000

# Migrate, then replace the shell with node so node receives SIGTERM directly
CMD ["sh", "-c", "node scripts/migrate.js && exec node server.js"]

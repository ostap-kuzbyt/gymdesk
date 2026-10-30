FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG VITE_API_URL=
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_AUTH0_ROLES_CLAIM=https://gymdesk/roles
ARG VITE_CURRENCY=UAH
RUN npm run build -w @gymdesk/web

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
ENV API_UPSTREAM=api:3000
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

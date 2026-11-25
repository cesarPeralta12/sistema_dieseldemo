# Compila la demo y la sirve como sitio estático.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# El lock se generó en Windows: npm install resuelve los binarios de Linux.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

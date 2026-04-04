FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]


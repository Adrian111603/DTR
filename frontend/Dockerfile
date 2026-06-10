FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5173

# Serve the production build via vite preview
CMD ["npm", "run", "preview"]

# Use Node.js 18 - compatible with Expo SDK 51
FROM node:18

# Set working directory
WORKDIR /app

# Install watchman for better file watching
RUN npm install -g watchman

# Copy package.json and package-lock.json
COPY app/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY app/ .

# Expose Expo default ports
EXPOSE 19000 19001 19002

# Command to run the app
CMD ["npx", "expo", "start"]
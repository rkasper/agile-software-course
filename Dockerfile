# Use the official Deno image
FROM denoland/deno:1.46.3

# Set the working directory in the container
WORKDIR /app

# Copy the entire project into the container
COPY . .

# Cache the dependencies
RUN deno cache src/app.ts
RUN deno cache tests/app_test.ts

# Set the default command to run the application
CMD ["run", "--allow-net", "--allow-read", "src/app.ts"]

# Expose the port the app runs on
EXPOSE 8000

# Add a new stage for running tests
FROM denoland/deno:1.46.3 AS test
WORKDIR /app
COPY . .
RUN deno cache tests/app_test.ts
CMD ["test", "--allow-net", "--allow-read"]

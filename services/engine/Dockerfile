# syntax=docker/dockerfile:1
# The engine is a broker worker — no exposed port.

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
# Prime the Gradle wrapper + dependency cache before copying sources
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle/ gradle/
RUN ./gradlew --no-daemon dependencies > /dev/null 2>&1 || true
COPY src/ src/
RUN ./gradlew --no-daemon installDist

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
COPY --from=build /src/build/install/consilience-engine ./
ENTRYPOINT ["./bin/consilience-engine"]

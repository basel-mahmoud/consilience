# syntax=docker/dockerfile:1
# Multi-stage build for the ASP.NET Core gateway.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
# Restore against the csproj first so layers cache when only source changes
COPY src/Consilience.Gateway/Consilience.Gateway.csproj src/Consilience.Gateway/
RUN dotnet restore src/Consilience.Gateway/Consilience.Gateway.csproj
COPY src/ src/
RUN dotnet publish src/Consilience.Gateway/Consilience.Gateway.csproj \
    -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# The platform sets PORT; bind Kestrel to it (default 8080)
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Consilience.Gateway.dll"]

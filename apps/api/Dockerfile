FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json ./
COPY apps/api/Tenacom.Api.csproj apps/api/
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then SSL_CERT_FILE=/run/secrets/build_ca dotnet restore apps/api/Tenacom.Api.csproj; \
    else dotnet restore apps/api/Tenacom.Api.csproj; fi
COPY apps/api apps/api
RUN dotnet publish apps/api/Tenacom.Api.csproj -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_HTTP_PORTS=8080
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Tenacom.Api.dll"]

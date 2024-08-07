FROM node:20-slim@sha256:a22f79e64de59efd3533828aecc9817bfdc1cd37dde598aa27d6065e7b1f0abc AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

COPY . /app
WORKDIR /app

ENV HOME="/app"
RUN chmod -R 777 /app
RUN corepack enable && corepack prepare

FROM base AS prod-deps
RUN apt update && apt install -y python3 make g++
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN apt update && apt install -y python3 make g++
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

EXPOSE 4321
CMD [ "pnpm", "run", "start" ]
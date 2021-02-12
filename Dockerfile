FROM node:alpine

RUN mkdir /action
WORKDIR /action

COPY action ./

RUN npm ci --only=prod

ENTRYPOINT ["node", "/action/index.js"]

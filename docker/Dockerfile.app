FROM node:24-bookworm
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends faketime \
  && rm -rf /var/lib/apt/lists/* \
  && FAKETIME_SO="$(dpkg -L libfaketime | grep -E 'libfaketime\.so\.1$' | head -n1)" \
  && printf '%s' "$FAKETIME_SO" > /etc/faketime-ldpreload.path \
  && test -s /etc/faketime-ldpreload.path
COPY docker/app-entrypoint.sh /usr/local/bin/app-entrypoint.sh
RUN chmod +x /usr/local/bin/app-entrypoint.sh
WORKDIR /app
ENTRYPOINT ["/usr/local/bin/app-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

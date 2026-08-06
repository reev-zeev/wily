# Dockerfile for Supabase local development
FROM supabase/postgres:15

# Install migrations
COPY supabase/migrations/*.sql /docker-entrypoint-initdb.d/

# Expose ports
EXPOSE 5432 54321

# Start command
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]

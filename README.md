# Vistula Task Manager

A simple Task Manager for the **Team Project – IT** course (Practical Assignment 1).
Plain HTML, CSS and JavaScript hosted on GitHub Pages. Tasks are stored in Supabase
(PostgreSQL) and read and written through the Supabase auto-generated REST API with `fetch()`.

- **Student ID:** 73196
- **Live application:** https://zelnaga-16.github.io/vistula-task-manager/
- **Repository:** https://github.com/zelnaga-16/vistula-task-manager
- **Contributor page:** https://zelnaga-16.github.io/vistula-task-manager/contribution.html
- **Contributor JSON:** https://zelnaga-16.github.io/vistula-task-manager/contribution.json

## Team collaboration (Pull Requests)

- Pull Request from my partner, merged into this repository: _to be added_
- My Pull Request, merged into my partner’s repository: _to be added_

## Features

- Display all tasks stored in the database
- Add a task (title is required, description is optional)
- Edit the title and description of a task
- Mark a task as completed or incomplete
- Delete a task
- Every change is saved in Supabase and survives a page refresh
- Errors are reported in the `#status-message` element

## REST API usage

Base URL: `https://udrigwdsgamqribcqluc.supabase.co/rest/v1`

- `GET /tasks?select=*&order=id.asc` – load all tasks
- `GET /tasks?id=eq.{id}&select=*` – read one task (done before every update)
- `POST /tasks` – create a task
- `PUT /tasks?id=eq.{id}` – save the complete task (edit, completed / incomplete)
- `DELETE /tasks?id=eq.{id}` – delete a task

Every request sends the publishable key in the `apikey` header. Write requests
add `Prefer: return=representation`, so the API returns the affected rows and
the app can detect an operation that changed nothing.

## Project files

- `index.html` – the Task Manager page
- `app.js` – application logic and REST calls
- `style.css` – styling
- `config.json` – public Supabase configuration (`supabaseUrl`, `supabasePublishableKey`, `tableName`)
- `schema.sql` – SQL that creates the `tasks` table, its RLS policies and test data
- `contribution.html`, `contribution.json` – added by my partner through a Pull Request
- `.github/workflows/supabase-keepalive.yml` – a daily read that keeps the free Supabase project from being paused

## Database setup

1. Create a separate Supabase project for this demo.
2. Open **SQL Editor**, paste the contents of `schema.sql` and run it.
3. Open **Connect** (or **Project Settings → API Keys**) and copy the project URL and the publishable key into `config.json`.

The `tasks` table has the columns `id` (bigint identity primary key), `title` (text, required),
`description` (text, optional) and `completed` (boolean, default `false`). Row Level Security is
enabled with policies that allow public select, insert, update and delete, because this is a
demonstration database with test data only. No secret keys are stored in this repository.

## Running locally

`config.json` is loaded with `fetch()`, and browsers block that for pages opened as `file://`.
Serve the folder over HTTP instead, for example `npx serve .` or `python -m http.server 8000`,
and open the printed local address.

# nostalgia

Project to explore cartoon openings and songs from movies from time when I was a child.
This is part of my cultural code.

Some songs have subtitles, some don't. Some have karaoke mode, some don't.

## How to run

Pre-requisites:

- [Go](https://golang.org/)
- [Caddy](https://caddyserver.com/)

To serve files locally on [http://localhost:80](http://localhost:80) run

```
caddy file-server
```

Yes, you can just open `index.html` in your browser, but some features will not work. Like loading `main.js` in Firefox due to CORS policy.

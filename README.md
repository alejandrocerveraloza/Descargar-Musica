# DJ Studio (PWA)

Buscador, reproductor de vista previa y descargador de música de **fuentes legales**.

## Archivos
index.html, manifest.json, sw.js, icon.svg (todos en la raíz del repositorio).

## Subir a GitHub y publicar en GitHub Pages
1. Crea una cuenta en github.com y pulsa **New repository** (p. ej. `dj-studio`, público).
2. Pulsa **uploading an existing file**, arrastra los 5 archivos y haz **Commit changes**.
   (Con git: `git init && git add . && git commit -m "init" && git branch -M main && git remote add origin https://github.com/TU_USUARIO/dj-studio.git && git push -u origin main`)
3. En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`, **Save**.
4. En 1-2 minutos estará en `https://TU_USUARIO.github.io/dj-studio/`.
5. En el móvil abre esa URL: Chrome → ⋮ → **Instalar aplicación / Añadir a pantalla de inicio**; Safari → Compartir → **Añadir a pantalla de inicio**.

## Ajustes
Pulsa ⚙ y pega tu `client_id` gratuito de Jamendo (https://devportal.jamendo.com) para activar su catálogo Creative Commons.

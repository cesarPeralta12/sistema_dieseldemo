import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Todo en un solo HTML: la demo se abre con doble clic y se puede enviar por mensaje.
export default defineConfig({ plugins: [react(), viteSingleFile()] })

import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@(.+)$/,
        replacement: new URL('./src/$1', import.meta.url).pathname,
      },
    ],
  },
})

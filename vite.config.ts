import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o site funciona em https://<usuario>.github.io/<repositorio>/
  // e em qualquer outra pasta, sem precisar saber o nome do repositório.
  base: './',
  test: {
    environment: 'node',
  },
} as any);

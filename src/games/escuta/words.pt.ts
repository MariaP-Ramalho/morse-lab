import { normalize } from '../../morse/normalize';

/** Palavras de 5 letras em português (acentos são removidos). */
const RAW = `
amigo livro praia tempo mundo verde noite terra campo pedra festa forte navio porto rádio
sinal letra ponto traço carta papel lápis porta chave nuvem chuva vento areia ponte barco
piano viola samba frevo banho sabor feliz calmo claro firme velho jovem gente filho irmão
tarde manhã feira banco trigo milho arroz limão manga melão caqui cacau leite pizza torta
molho prato garfo forno cobra tigre zebra corvo pomba cisne polvo peixe lhama burro cabra
vespa mosca grilo coala panda folha grama serra morro lagoa costa monte névoa brisa astro
plano vídeo disco caixa bolsa meias calça botas cinto régua tinta museu circo palco filme
drama conto poema verso canto sonho ideia mente corpo braço perna dente nariz testa andar
comer beber falar ouvir viver pular nadar jogar achar abrir subir olhar tocar dizer fazer
poder saber morar girar lutar baixo largo curto longo lento cheio vazio morno suave limpo
pobre bravo manso sábio lindo justo certo falso livre pleno único comum nobre sutil vasto
denso macio azedo hotel praça nação líder chefe grupo clube golpe ritmo dança banda coral
harpa sinos apito grito morse radar pilha motor carro avião metrô freio malas verão abril
junho julho março ontem agora nunca antes junto perto longe acima norte leste oeste
`;

export const WORDS: string[] = [
  ...new Set(
    RAW.split(/\s+/)
      .map(normalize)
      .filter((w) => /^[A-Z]{5}$/.test(w)),
  ),
];

/** Sorteia palavras sem repetir as últimas. */
export function wordPicker(list = WORDS, random = Math.random): () => string {
  const recent: string[] = [];
  return () => {
    let w: string;
    do w = list[Math.floor(random() * list.length)];
    while (recent.includes(w) && list.length > recent.length);
    recent.push(w);
    if (recent.length > Math.min(30, list.length - 1)) recent.shift();
    return w;
  };
}

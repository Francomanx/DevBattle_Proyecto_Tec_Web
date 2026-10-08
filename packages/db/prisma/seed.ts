import { prisma } from "../src/index";

async function main() {
  const challenges = [
    {
      slug: "two-sum",
      title: "Two Sum",
      description:
        "Dado un arreglo de enteros y un objetivo, devuelve los índices de los dos números que suman el objetivo.",
      difficulty: "EASY" as const,
    },
    {
      slug: "valid-parentheses",
      title: "Valid Parentheses",
      description:
        "Dada una cadena con paréntesis, corchetes y llaves, determina si está correctamente balanceada.",
      difficulty: "MEDIUM" as const,
    },
    {
      slug: "median-of-two-sorted-arrays",
      title: "Median of Two Sorted Arrays",
      description:
        "Encuentra la mediana de dos arreglos ordenados en O(log(m + n)).",
      difficulty: "HARD" as const,
    },
  ];

  for (const challenge of challenges) {
    await prisma.challenge.upsert({
      where: { slug: challenge.slug },
      update: challenge,
      create: challenge,
    });
  }

  console.log(`Seed OK: ${challenges.length} retos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

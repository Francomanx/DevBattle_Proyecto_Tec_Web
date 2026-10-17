import { prisma } from "../src/index";

async function main() {
  const now = new Date();
  const enDosDias = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const enUnDia = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const haceCincoDias = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  const challenges = [
    {
      slug: "two-sum",
      title: "Two Sum",
      description:
        "Dado un arreglo de enteros y un objetivo, devuelve los índices de los dos números que suman el objetivo.",
      difficulty: "EASY" as const,
      hostId: "host-temporal-123",

      status: "active" as const,
      activeDeadLine: enDosDias,
      formats: {
        connectOrCreate: [
          { where: { name: "React" }, create: { name: "React" } },
          { where: { name: "TailwindCSS" }, create: { name: "TailwindCSS" } }
        ]
      }
    },

    {
      slug: "valid-parentheses",
      title: "Valid Parentheses",
      description:
        "Dada una cadena con paréntesis, corchetes y llaves, determina si está correctamente balanceada.",
      difficulty: "MEDIUM" as const,
      hostId: "host-temporal-123",

      status: "vote" as const,
      voteDeadLine: enUnDia,
      formats: {
        connectOrCreate: [
          { where: { name: "NodeJS" }, create: { name: "NodeJS" } },
          { where: { name: "Express" }, create: { name: "Express" } }
        ]
      }
    },

    {
      slug: "median-of-two-sorted-arrays",
      title: "Median of Two Sorted Arrays",
      description:
        "Encuentra la mediana de dos arreglos ordenados en O(log(m + n)).",
      difficulty: "HARD" as const,
      hostId: "host-temporal-123",

      status: "completed" as const,
      completedAt: haceCincoDias,
      formats: {
        connectOrCreate: [
          { where: { name: "Algoritmos" }, create: { name: "Algoritmos" } }
        ]
      }
    },

    {
      slug: "clon-de-facebook",
      title: "Clon de Facebook",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      difficulty: "EASY" as const,
      hostId: "host-temporal-123",
      status: "active" as const,
      activeDeadLine: enDosDias,
      formats: {
        connectOrCreate: [
          { where: { name: "React" }, create: { name: "React" } }
        ]
      }
    },

    {
      slug: "clon-de-facebook-2",
      title: "Clon de Facebook 2",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      difficulty: "EASY" as const,
      hostId: "host-temporal-123",
      status: "active" as const,
      activeDeadLine: enDosDias,
      formats: {
        connectOrCreate: [
          { where: { name: "React" }, create: { name: "React" } }
        ]
      }
    },

    {
      slug: "clon-de-facebook-3",
      title: "Clon de Facebook 3",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      difficulty: "EASY" as const,
      hostId: "host-temporal-123",
      status: "active" as const,
      activeDeadLine: enDosDias,
      formats: {
        connectOrCreate: [
          { where: { name: "React" }, create: { name: "React" } }
        ]
      }
    },

    {
      slug: "clon-de-facebook-4",
      title: "Clon de Facebook 4",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      difficulty: "EASY" as const,
      hostId: "host-temporal-123",
      status: "active" as const,
      activeDeadLine: enDosDias,
      formats: {
        connectOrCreate: [
          { where: { name: "React" }, create: { name: "React" } }
        ]
      }
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

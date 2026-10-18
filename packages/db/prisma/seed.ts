import { prisma, CompetitionStatus, CompetitionRole, MetricType, FriendshipStatus, GroupRole, NotificationType } from "../src/index";

async function main() {
  console.log("Limpiando datos existentes...");
  // En orden inverso a las dependencias por integridad referencial
  await prisma.vote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.project.deleteMany();
  await prisma.metric.deleteMany();
  await prisma.competitionParticipant.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creando usuarios...");
  const userAdmin = await prisma.user.create({
    data: {
      username: "alex_organizer",
      email: "alex@devbattle.com",
      passwordHash: "hash_admin_secret_123",
      description: "Organizador principal de DevBattle y arquitecto de software.",
      githubUrl: "https://github.com/alex-organizer",
      competitionsWon: 5,
    },
  });

  const userDev1 = await prisma.user.create({
    data: {
      username: "lucia_coder",
      email: "lucia@devbattle.com",
      passwordHash: "hash_lucia_secret_123",
      description: "Entusiasta de algoritmos competitivos y TypeScript.",
      githubUrl: "https://github.com/lucia-coder",
      competitionsWon: 2,
    },
  });

  const userDev2 = await prisma.user.create({
    data: {
      username: "matias_dev",
      email: "matias@devbattle.com",
      passwordHash: "hash_matias_secret_123",
      description: "Desarrollador backend y entusiasta de bases de datos distribuidas.",
      githubUrl: "https://github.com/matias-dev",
      competitionsWon: 1,
    },
  });

  const userLuis = await prisma.user.create({
    data: {
      username: "luis_dev",
      email: "luis@devbattle.com",
      passwordHash: "hash_luis_secret_123",
      description: "Organizador principal de DevBattle y creador de retos.",
      githubUrl: "https://github.com/luis-dev",
      competitionsWon: 3,
    },
  });

  console.log("Creando competencias...");
  const compAlgoritmos = await prisma.competition.create({
    data: {
      title: "Desafío de Grafos y Optimización 2026",
      description: "Encuentra el camino más eficiente para flujos de red bajo restricciones de latencia dinámica.",
      rules: "1. Soluciones en cualquier lenguaje compilado o tipado. 2. Límite de tiempo: 2s por caso de prueba. 3. Sin librerías externas para el algoritmo central.",
      fileFormat: "zip",
      viewCount: 142,
      status: CompetitionStatus.ACTIVE,
      submissionDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 días
      votingDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 días
    },
  });

  const compHackathon = await prisma.competition.create({
    data: {
      title: "Hackathon Web Realtime",
      description: "Construye una aplicación colaborativa en tiempo real utilizando WebSockets o Server-Sent Events.",
      rules: "1. Repositorio público con README claro. 2. Despliegue funcional en producción. 3. Diseño responsive y accesible.",
      fileFormat: "url",
      viewCount: 380,
      status: CompetitionStatus.VOTING,
      submissionDeadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // finalizó hace 2 días
      votingDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 días para votar
    },
  });

  const remainingTime = new Date(Date.now() + (1 * 24 * 60 + 19 * 60 + 2) * 60 * 1000);
  const votingTime = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

  const compFb2 = await prisma.competition.create({
    data: {
      title: "Clon de Facebook 2",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      rules: "1. Componentes en React modernos. 2. Feed funcional con posts y likes. 3. Panel de amigos interactivo.",
      fileFormat: "zip",
      viewCount: 240,
      status: CompetitionStatus.ACTIVE,
      submissionDeadline: remainingTime,
      votingDeadline: votingTime,
    },
  });

  const compFb3 = await prisma.competition.create({
    data: {
      title: "Clon de Facebook 3",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      rules: "1. Componentes en React modernos. 2. Feed funcional con posts y likes. 3. Panel de amigos interactivo.",
      fileFormat: "zip",
      viewCount: 310,
      status: CompetitionStatus.ACTIVE,
      submissionDeadline: remainingTime,
      votingDeadline: votingTime,
    },
  });

  const compFb4 = await prisma.competition.create({
    data: {
      title: "Clon de Facebook 4",
      description: "Recrea la experiencia del feed, junto al panel de amigos.",
      rules: "1. Componentes en React modernos. 2. Feed funcional con posts y likes. 3. Panel de amigos interactivo.",
      fileFormat: "link",
      viewCount: 420,
      status: CompetitionStatus.ACTIVE,
      submissionDeadline: remainingTime,
      votingDeadline: votingTime,
    },
  });

  console.log("Registrando participantes...");
  await prisma.competitionParticipant.createMany({
    data: [
      {
        userId: userAdmin.id,
        competitionId: compAlgoritmos.id,
        role: CompetitionRole.HOST,
      },
      {
        userId: userDev1.id,
        competitionId: compAlgoritmos.id,
        role: CompetitionRole.DEV,
      },
      {
        userId: userDev2.id,
        competitionId: compAlgoritmos.id,
        role: CompetitionRole.MOD,
      },
      {
        userId: userDev1.id,
        competitionId: compHackathon.id,
        role: CompetitionRole.DEV,
      },
      {
        userId: userDev2.id,
        competitionId: compHackathon.id,
        role: CompetitionRole.DEV,
      },
    ],
  });

  console.log("Definiendo métricas de evaluación...");
  const metricEficiencia = await prisma.metric.create({
    data: {
      competitionId: compAlgoritmos.id,
      name: "Eficiencia Algorítmica",
      type: MetricType.OBJECTIVE,
      maxValue: 100,
    },
  });

  const metricCalidad = await prisma.metric.create({
    data: {
      competitionId: compAlgoritmos.id,
      name: "Calidad y Legibilidad del Código",
      type: MetricType.SUBJECTIVE,
      maxValue: 10,
    },
  });

  const metricUx = await prisma.metric.create({
    data: {
      competitionId: compHackathon.id,
      name: "Experiencia de Usuario (UX/UI)",
      type: MetricType.SUBJECTIVE,
      maxValue: 50,
    },
  });

  console.log("Postulando proyectos...");
  const project1 = await prisma.project.create({
    data: {
      competitionId: compAlgoritmos.id,
      authorId: userDev1.id,
      title: "FastFlow Router",
      description: "Implementación en Rust con paralelismo lock-free usando SIMD para la búsqueda de caminos mínimos.",
      repoUrl: "https://github.com/lucia-coder/fastflow-router",
      fileUrl: "https://storage.devbattle.com/submissions/fastflow.zip",
    },
  });

  const project2 = await prisma.project.create({
    data: {
      competitionId: compHackathon.id,
      authorId: userDev2.id,
      title: "SyncBoard Studio",
      description: "Pizarra interactiva colaborativa con sincronización de estado CRDTs en tiempo real.",
      repoUrl: "https://github.com/matias-dev/syncboard",
      fileUrl: "https://syncboard-demo.vercel.app",
    },
  });

  console.log("Emitiendo votos y comentarios...");
  await prisma.vote.create({
    data: {
      projectId: project1.id,
      metricId: metricEficiencia.id,
      voterId: userDev2.id,
      score: 95,
    },
  });

  await prisma.vote.create({
    data: {
      projectId: project1.id,
      metricId: metricCalidad.id,
      voterId: userAdmin.id,
      score: 9,
    },
  });

  await prisma.comment.create({
    data: {
      projectId: project1.id,
      authorId: userDev2.id,
      content: "Excelente estructura modular. La reducción en tiempo de ejecución en benchmarks es impresionante.",
    },
  });

  console.log("Creando amistades, grupos y mensajería...");
  await prisma.friendship.create({
    data: {
      user1Id: userDev1.id,
      user2Id: userDev2.id,
      status: FriendshipStatus.ACCEPTED,
    },
  });

  const devGroup = await prisma.group.create({
    data: {
      title: "Rust & Performance Club",
      description: "Grupo de estudio para optimización a bajo nivel y estructuras de datos de alto rendimiento.",
    },
  });

  await prisma.groupMember.createMany({
    data: [
      { groupId: devGroup.id, userId: userAdmin.id, role: GroupRole.ADMIN },
      { groupId: devGroup.id, userId: userDev1.id, role: GroupRole.MEMBER },
      { groupId: devGroup.id, userId: userDev2.id, role: GroupRole.MEMBER },
    ],
  });

  await prisma.message.create({
    data: {
      senderId: userDev1.id,
      receiverId: userDev2.id,
      content: "¡Hola Matías! ¿Viste la métrica de tiempo de ejecución que logramos?",
    },
  });

  await prisma.message.create({
    data: {
      senderId: userAdmin.id,
      groupId: devGroup.id,
      content: "¡Bienvenidos al grupo! La próxima competencia de rendimiento comienza en dos semanas.",
    },
  });

  console.log("Creando notificaciones...");
  await prisma.notification.createMany({
    data: [
      {
        userId: userDev1.id,
        type: NotificationType.STATE_CHANGE,
        content: "La competencia 'Desafío de Grafos y Optimización 2026' ha cambiado de estado a VOTING.",
        isRead: false,
      },
      {
        userId: userDev2.id,
        type: NotificationType.MESSAGE,
        content: "Tienes un nuevo mensaje directo de lucia_coder.",
        isRead: true,
      },
    ],
  });

  console.log("¡Seed completado con éxito! Se poblaron las 12 entidades con los enums actualizados.");
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

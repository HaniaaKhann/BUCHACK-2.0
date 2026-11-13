export interface ConnectionRegistry {
  open(userId: string, close: () => void): () => void;
  count(userId: string): number;
  total(): number;
}

interface Connection {
  userId: string;
  close: () => void;
}

export function createConnectionRegistry(maxPerUser: number): ConnectionRegistry {
  const connections: Connection[] = [];
  const countFor = (userId: string): number =>
    connections.filter((connection) => connection.userId === userId).length;

  return {
    open(userId, close) {
      const connection = { userId, close };
      connections.push(connection);
      while (countFor(userId) > maxPerUser) {
        const oldest = connections.find((existing) => existing.userId === userId);
        if (oldest === undefined || oldest === connection) break;
        oldest.close();
        const index = connections.indexOf(oldest);
        if (index >= 0) connections.splice(index, 1);
      }
      return () => {
        const index = connections.indexOf(connection);
        if (index >= 0) connections.splice(index, 1);
      };
    },
    count: countFor,
    total: () => connections.length,
  };
}

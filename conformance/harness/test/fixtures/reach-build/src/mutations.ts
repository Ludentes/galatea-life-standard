// The fixture's declarations: where its mutation is read from the environment.
export function mutationFromEnv(env: NodeJS.ProcessEnv): string | undefined {
  return env.MUTATION;
}

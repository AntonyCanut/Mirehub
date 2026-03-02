import { RulesManager } from './RulesManager'

interface Props {
  projectPath: string
}

export function CodexRulesTab({ projectPath }: Props) {
  return <RulesManager projectPath={projectPath} />
}

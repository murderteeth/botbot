import { template } from '@/lib/template'

export default template`
START MESSAGE
${'message'}
END MESSAGE

START CODE(${'code_path'})
${'code'}
END CODE(${'code_path'})
`

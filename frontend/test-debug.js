import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BrutalLabel } from './src/components/ui-brutal'

const { container } = render(<MemoryRouter><BrutalLabel htmlFor="input-id">Label</BrutalLabel></MemoryRouter>)
const label = container.querySelector('label')
console.log('label:', label)
console.log('htmlFor attr:', label?.getAttribute('htmlFor'))

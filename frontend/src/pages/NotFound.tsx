import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Excavator from '../components/Excavator'
import { C } from '../theme'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}><Excavator size={320} /></Box>
      <Typography variant="h2" sx={{ mt: 2 }}><span className="gradient-text">404</span> · nothing dug up here</Typography>
      <Typography sx={{ color: C.muted, mt: 1, mb: 3 }}>This page doesn't exist. The excavator checked twice.</Typography>
      <Button variant="contained" onClick={() => navigate('/')}>Back to overview</Button>
    </Box>
  )
}

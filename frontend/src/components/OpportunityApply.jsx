import { useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { Link } from 'react-router'
import { AuthContext } from '../context/AuthContext'
import { createApplication } from '../context/applicationApi'

export function ApplicationAction({ status = 'idle', message = '', opportunityTitle, onApply }) {
  const applied = status === 'submitted' || status === 'duplicate'
  const submitting = status === 'submitting'
  return (
    <div className="mt-6 border-t border-base-300 pt-5" aria-busy={submitting}>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn btn-primary min-w-40 max-w-full" type="button" onClick={onApply}
          disabled={submitting || applied} aria-label={`${applied ? 'Applied' : submitting ? 'Applying' : 'Apply'} for ${opportunityTitle}`}>
          {submitting ? <><span className="loading loading-spinner loading-xs" aria-hidden="true" /> Applying...</>
            : applied ? <><CheckCircle2 size={17} aria-hidden="true" /> Applied</>
              : <><Send size={17} aria-hidden="true" /> Apply</>}
        </button>
        <Link className="link link-primary text-sm" to="/applications">My applications</Link>
      </div>
      {applied && <p role="status" className="mt-3 text-sm leading-6 text-success">
        {status === 'duplicate' ? 'You have already applied for this opportunity.' : 'Application submitted successfully.'}
      </p>}
      {message && <p role="alert" className="mt-3 break-words text-sm leading-6 text-error">{message}</p>}
    </div>
  )
}

export default function OpportunityApply({ opportunityId, opportunityTitle }) {
  const { user, token, signOut } = useContext(AuthContext)
  const [state, setState] = useState({ status: 'idle', message: '' })
  const requestRef = useRef(null)

  useEffect(() => () => requestRef.current?.abort(), [token, opportunityId])

  async function apply() {
    if (user.role !== 'student' || requestRef.current || state.status === 'submitted' || state.status === 'duplicate') return
    const controller = new AbortController()
    requestRef.current = controller
    setState({ status: 'submitting', message: '' })
    try {
      await createApplication(token, opportunityId, controller.signal)
      if (!controller.signal.aborted) setState({ status: 'submitted', message: '' })
    } catch (error) {
      if (controller.signal.aborted) return
      if (error.status === 401) {
        signOut()
        return
      }
      if (error.status === 409) {
        setState({ status: 'duplicate', message: '' })
        return
      }
      let message = error.message || 'Unable to submit this application.'
      if (!error.status || error.status >= 500) {
        message = 'Submission could not be confirmed. Check My applications before trying again.'
      }
      setState({ status: 'error', message })
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  if (user.role !== 'student') return null
  return <ApplicationAction {...state} opportunityTitle={opportunityTitle} onApply={apply} />
}

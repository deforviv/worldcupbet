import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../config/api';

export function useRequireAuth() {
  const navigate = useNavigate();

  const requireAuth = (callback) => {
    // Check if the user has a valid session token
    const token = getAuthToken();
    
    if (!token) {
      // User is not authenticated -> redirect to Auth page (Registration mode)
      navigate('/auth?mode=register');
      return false;
    }
    
    // User is authenticated -> proceed with the action
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  return requireAuth;
}

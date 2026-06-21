import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useHistory } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { LoadingState, ErrorState } from '../components/States';
import { ChatHistory } from '../components/ChatHistory';

export function HistoryPage() {
  const { id = '' } = useParams();
  const history = useHistory(id);

  if (history.isLoading) return <LoadingState />;
  if (history.isError) {
    return <ErrorState message={extractErrorMessage(history.error)} />;
  }

  return (
    <section className="page page--narrow">
      <div className="breadcrumb">
        <Link className="link" to="/requests">
          ← Billing Requests
        </Link>
      </div>

      <header className="page__head">
        <h1>Activity History</h1>
      </header>

      <ChatHistory groups={history.data || []} />
    </section>
  );
}

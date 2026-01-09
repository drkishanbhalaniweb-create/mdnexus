
import Header from './Header';
import Footer from './Footer';
import CommitmentSection from './CommitmentSection';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <CommitmentSection />
      <Footer />
    </div>
  );
};

export default Layout;

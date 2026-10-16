import type {Metadata} from 'next';
import './style.css';
export const metadata:Metadata={title:'Finance Recon | SBI & RBI',description:'Browser-side finance reconciliation prototype'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
});

interface MermaidProps {
    chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const idRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        if (chart) {
            // Need to clear error
            setError(null);

            // Mermaid render is async
            const renderDiagram = async () => {
                try {
                    // render returns { svg, bindFunctions } in v10+
                    const { svg } = await mermaid.render(idRef.current, chart);
                    setSvg(svg);
                } catch (err) {
                    console.error('Mermaid render error:', err);
                    setError('Invalid Mermaid syntax');
                    // Mermaid might leave garbage in DOM if error occurs, but render tries to clean up
                }
            };

            renderDiagram();
        }
    }, [chart]);

    if (error) {
        return <div style={{ color: 'red', border: '1px solid red', padding: '8px', borderRadius: '4px' }}>{error}</div>;
    }

    return (
        <div
            className="mermaid"
            dangerouslySetInnerHTML={{ __html: svg }}
            style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}
        />
    );
};

export default Mermaid;

const admin = require('firebase-admin');

try {
    console.log('Testing camelCase keys...');
    const cred = admin.credential.cert({
        projectId: 'test-project',
        clientEmail: 'test@example.com',
        // Intentionally missing privateKey to see if it complains about missing privateKey or private_key
    });
    console.log('camelCase keys worked (unexpectedly)');
} catch (error) {
    console.log('camelCase keys failed:', error.message);
}

try {
    console.log('\nTesting snake_case keys...');
    const cred = admin.credential.cert({
        project_id: 'test-project',
        client_email: 'test@example.com',
        // Intentionally missing private_key
    });
    console.log('snake_case keys worked');
} catch (error) {
    console.log('snake_case keys failed:', error.message);
}

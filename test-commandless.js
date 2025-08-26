// Test script for commandless functionality
const { isSongQuery } = require('./utils/centralUtils.js');

async function testSongValidation() {
    console.log('Testing song query validation...\n');
    
    const testCases = [
        // Valid song queries
        { input: 'Bohemian Rhapsody', expected: true, description: 'Classic song name' },
        { input: 'The Weeknd Blinding Lights', expected: true, description: 'Artist and song' },
        { input: 'Ed Sheeran - Shape of You', expected: true, description: 'Artist - Song format' },
        { input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: true, description: 'YouTube URL' },
        { input: 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh', expected: true, description: 'Spotify track URL' },
        { input: 'Imagine Dragons Thunder', expected: true, description: 'Band name with song' },
        { input: 'Billie Eilish bad guy', expected: true, description: 'Lowercase song name' },
        
        // Invalid queries that should be filtered
        { input: 'hi', expected: false, description: 'Common greeting' },
        { input: 'hello', expected: false, description: 'Common greeting' },
        { input: 'test', expected: false, description: 'Test message' },
        { input: 'lol', expected: false, description: 'Chat abbreviation' },
        { input: '@everyone', expected: false, description: 'Everyone mention' },
        { input: '@here', expected: false, description: 'Here mention' },
        { input: 'discord.gg/invite', expected: false, description: 'Discord invite' },
        { input: '123', expected: false, description: 'Only numbers' },
        { input: '!@#$%', expected: false, description: 'Only special characters' },
        { input: '', expected: false, description: 'Empty string' },
        { input: ' ', expected: false, description: 'Only whitespace' },
        { input: 'a', expected: false, description: 'Single character' },
        { input: 'x'.repeat(201), expected: false, description: 'Too long (>200 chars)' },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        try {
            const result = await isSongQuery(testCase.input);
            const success = result === testCase.expected;
            
            if (success) {
                console.log(`✅ PASS: "${testCase.input}" - ${testCase.description}`);
                passed++;
            } else {
                console.log(`❌ FAIL: "${testCase.input}" - ${testCase.description}`);
                console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
                failed++;
            }
        } catch (error) {
            console.log(`💥 ERROR: "${testCase.input}" - ${testCase.description}`);
            console.log(`   Error: ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! Song validation is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Please review the validation logic.');
    }
}

// Test database utilities (mock test)
function testDatabaseUtils() {
    console.log('\n🗄️  Testing database utilities...');
    
    try {
        const { getCentralSetup, updateCentralSetup, disableCentralSetup } = require('./utils/centralUtils.js');
        console.log('✅ Database utility functions imported successfully');
        
        // Test utility functions exist
        if (typeof getCentralSetup === 'function') {
            console.log('✅ getCentralSetup function exists');
        } else {
            console.log('❌ getCentralSetup function missing');
        }
        
        if (typeof updateCentralSetup === 'function') {
            console.log('✅ updateCentralSetup function exists');
        } else {
            console.log('❌ updateCentralSetup function missing');
        }
        
        if (typeof disableCentralSetup === 'function') {
            console.log('✅ disableCentralSetup function exists');
        } else {
            console.log('❌ disableCentralSetup function missing');
        }
        
    } catch (error) {
        console.log('❌ Error importing database utilities:', error.message);
    }
}

// Test command files
function testCommandFiles() {
    console.log('\n🎮 Testing command files...');
    
    const commands = [
        'setup-central',
        'disable-central', 
        'central-status'
    ];
    
    for (const commandName of commands) {
        try {
            const command = require(`./commands/${commandName}.js`);
            
            if (command.name && command.description && command.run) {
                console.log(`✅ ${commandName}.js - Valid command structure`);
            } else {
                console.log(`❌ ${commandName}.js - Missing required properties`);
            }
        } catch (error) {
            console.log(`❌ ${commandName}.js - Import error: ${error.message}`);
        }
    }
}

// Test event files
function testEventFiles() {
    console.log('\n📨 Testing event files...');
    
    try {
        const messageCreateEvent = require('./events/messageCreate.js');
        
        if (typeof messageCreateEvent === 'function') {
            console.log('✅ messageCreate.js - Valid event handler');
        } else {
            console.log('❌ messageCreate.js - Invalid event handler structure');
        }
    } catch (error) {
        console.log('❌ messageCreate.js - Import error:', error.message);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🧪 Starting Commandless Functionality Tests\n');
    console.log('=' .repeat(50));
    
    await testSongValidation();
    testDatabaseUtils();
    testCommandFiles();
    testEventFiles();
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 Test suite completed!');
    console.log('\nNext steps:');
    console.log('1. Configure your MongoDB URI in config.js');
    console.log('2. Configure your Lavalink nodes in config.js');
    console.log('3. Start the bot with: npm start');
    console.log('4. Use /setup-central in a Discord server to enable commandless functionality');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testSongValidation,
    testDatabaseUtils,
    testCommandFiles,
    testEventFiles,
    runAllTests
};

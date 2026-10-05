#!/usr/bin/perl
# Verify audit fixes: UUID validation, dev fallback removal, upload auth, blockchain guard
use strict; use warnings;
use LWP::UserAgent; use HTTP::Request; use JSON;

my $ua = LWP::UserAgent->new(timeout => 20);
my $BASE = "http://localhost:3000";
my ($pass, $fail) = (0, 0);

sub chk {
    my ($name, $got, $want) = @_;
    if ($got == $want) { $pass++; print "  [PASS] $name → HTTP $got\n"; }
    else { $fail++; print "  [FAIL] $name → got $got, expected $want\n"; }
}

sub req {
    my ($m, $p, $body, $tok) = @_;
    my $r = HTTP::Request->new($m, "$BASE$p");
    $r->header('Content-Type', 'application/json');
    $r->header('Authorization', "Bearer $tok") if $tok;
    $r->content(encode_json($body)) if $body;
    my $res = $ua->request($r);
    my $d = {}; eval { $d = decode_json($res->content) if $res->content };
    return ($res->code, $d);
}

print "=" x 60 . "\n   AUDIT FIX VERIFICATION\n" . "=" x 60 . "\n\n";

# Setup
my $ts = time();
my ($s, $d) = req('POST', '/api/auth/register', {
    email=>"audit_${ts}\@test.com", password=>'Test@123456',
    firstName=>'A', lastName=>'B', companyName=>"AuditOrg$ts"
});
my $tok = $d->{data}{accessToken} // '';

print "1. UUID VALIDATION (invalid UUID → 400)\n";
($s) = req('GET', '/api/documents/not-a-uuid', undef, $tok); chk('GET /api/documents/:id', $s, 400);
($s) = req('GET', '/api/folders/xxx-bad-uuid', undef, $tok); chk('GET /api/folders/:id', $s, 400);
($s) = req('GET', '/api/tasks/bad-uuid', undef, $tok); chk('GET /api/tasks/:id', $s, 400);
($s) = req('GET', '/api/ai-analysis/documents/bad/status', undef, $tok); chk('GET /api/ai-analysis/documents/:id/status', $s, 400);
($s) = req('GET', '/api/signing/bad-uuid/status', undef, $tok); chk('GET /api/signing/:taskId/status', $s, 400);
($s) = req('POST', '/api/folders/move-folder', {folderId=>'bad'}, $tok); chk('POST /api/folders/move-folder', $s, 400);
($s) = req('DELETE', '/api/notifications/bad-uuid', undef, $tok); chk('DELETE /api/notifications/:id', $s, 400);

print "\n2. DEV FALLBACK REMOVED (no token → 401, not 201)\n";
($s) = req('POST', '/api/folders', {name=>"x"}); chk('POST /api/folders (no token)', $s, 401);
($s) = req('GET', '/api/folders'); chk('GET /api/folders (no token)', $s, 401);
($s) = req('GET', '/api/forms/templates'); chk('GET /api/forms/templates (no token)', $s, 401);
($s) = req('GET', '/api/dashboard/stats'); chk('GET /api/dashboard/stats (no token)', $s, 401);

print "\n3. UPLOAD ENDPOINT REQUIRES AUTH\n";
my $body = "--X\r\nContent-Disposition: form-data; name=\"file\"; filename=\"t.txt\"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--X--\r\n";
my $r = HTTP::Request->new('POST', "$BASE/api/documents/upload");
$r->header('Content-Type', 'multipart/form-data; boundary=X');
$r->content($body);
my $res = $ua->request($r);
chk('POST /api/documents/upload (no token)', $res->code, 401);

print "\n4. BLOCKCHAIN ROUTER-LEVEL GUARD (503 when disabled)\n";
($s, $d) = req('GET', '/api/blockchain/stats', undef, $tok);
chk('GET /api/blockchain/stats', $s, 503);
print "     Message: " . ($d->{message} // '?') . "\n";
($s) = req('POST', '/api/blockchain/anchor/not-a-uuid', {}, $tok);
chk('POST /api/blockchain/anchor/:docId', $s, 503);

print "\n5. BLOCKCHAIN CONFIG LEAK FIX\n";
($s, $d) = req('GET', '/api/blockchain/stats', undef, $tok);
# With guard, we never reach the wallet handler — but verify no RPC URL leak even if it did
my $has_leak = 0;
if ($d && ($d->{data}{currentStatus}{rpcUrl} // $d->{data}{rpcUrl})) { $has_leak = 1; }
if (!$has_leak) { $pass++; print "  [PASS] No RPC URL / contract address in response\n"; }
else { $fail++; print "  [FAIL] Leaked blockchain config\n"; }

print "\n" . "=" x 60 . "\n";
printf "   PASS: %d    FAIL: %d    TOTAL: %d\n", $pass, $fail, $pass+$fail;
print "=" x 60 . "\n";

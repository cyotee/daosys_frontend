export async function listLocalAbis() {
    const res = await fetch('/api/local-abis?list=true');
    if (!res.ok) throw new Error('failed to list local abis');
    return res.json();
}

export async function getLocalAbi(name: string) {
    const res = await fetch(`/api/local-abis?name=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error('local abi not found');
    return res.json();
}

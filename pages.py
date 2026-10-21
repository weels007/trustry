"""Trusted pages the tests can certify an event against.

A page can only certify one event, because the contract reserves it. Every
run therefore takes the next page that has not been used yet.

Each entry carries a phrase that really is on the page and a description that
really describes it, so the notary can reach a verdict either way.
"""

CANDIDATES = [
    ("https://docs.genlayer.com/", "GenLayer",
     "The GenLayer homepage, introducing the GenLayer project and its documentation"),
    ("https://docs.genlayer.com/developers", "GenLayer",
     "The GenLayer developers page about building on GenLayer"),
    ("https://docs.genlayer.com/understand-genlayer-protocol", "GenLayer",
     "The GenLayer page that explains the GenLayer protocol"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/introduction", "GenLayer",
     "The GenLayer introduction to intelligent contracts"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/storage", "GenLayer",
     "The GenLayer page about storage in intelligent contracts"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle", "GenLayer",
     "The GenLayer page about the equivalence principle"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/debugging", "GenLayer",
     "The GenLayer page about debugging intelligent contracts"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/error-handling", "GenLayer",
     "The GenLayer page about error handling in intelligent contracts"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/crafting-prompts", "GenLayer",
     "The GenLayer page about crafting prompts for validators"),
    ("https://docs.genlayer.com/developers/intelligent-contracts/security-and-best-practices/prompt-injection", "GenLayer",
     "The GenLayer page about prompt injection and how to avoid it"),
    ("https://docs.genlayer.com/developers/decentralized-applications/architecture-overview", "GenLayer",
     "The GenLayer page about the architecture of a decentralized application"),
    ("https://docs.genlayer.com/developers/decentralized-applications/genlayer-js", "GenLayer",
     "The GenLayer page about the GenLayer javascript library"),
    ("https://docs.genlayer.com/understand-genlayer-protocol/typical-use-cases", "GenLayer",
     "The GenLayer page about what the protocol is used for"),
    ("https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy", "GenLayer",
     "The GenLayer page about optimistic democracy"),
    ("https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/non-deterministic-operations-handling", "GenLayer",
     "The GenLayer page about handling non-deterministic operations"),
    ("https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/transactions", "GenLayer",
     "The GenLayer page about transactions and finality"),
    ("https://blog.ethereum.org/", "Ethereum",
     "The Ethereum blog, publishing an update about Ethereum"),
    ("https://www.cointelegraph.com/", "Bitcoin",
     "Cointelegraph news coverage about Bitcoin"),
    ("https://github.com/genlayerlabs", "GenLayer",
     "The GitHub organisation that holds the GenLayer repositories"),
    ("https://ethereum.org/en/", "Ethereum",
     "The Ethereum homepage, describing the Ethereum project"),
    ("https://ethereum.org/en/roadmap/", "Ethereum",
     "The Ethereum roadmap page, describing what is planned"),
    ("https://github.com/ethereum", "Ethereum",
     "The GitHub organisation that holds the Ethereum repositories"),
]

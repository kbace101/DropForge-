/// Enhanced NFT Platform with Dropforge Integration
#[allow(lint(public_entry), unused_use, duplicate_alias, deprecated_usage)]
module dropforge::dropforge {
    use std::string::{Self, String};
    use std::option;
    use std::vector;
    use sui::url::{Self, Url};
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::display;
    use sui::package;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use sui::transfer_policy::{Self, TransferPolicy};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};

    // === ONE-TIME WITNESS ===
    public struct DROPFORGE has drop {}

    // === NFT ===
    public struct NFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: Url,
        collection_id: ID,
        token_id: u64,
        creator: address,
        royalty_bps: u16,
    }

    // === COLLECTION ===
    public struct Collection has key, store {
        id: UID,
        name: String,
        description: String,
        creator: address,
        max_supply: u64,
        minted_count: u64,
        royalty_bps: u16,
        base_uri: String,
        mint_price: u64,
        treasury: Balance<SUI>,
        metadata: Table<u64, NFTMetadata>,
    }

    // === NFT METADATA ===
    public struct NFTMetadata has store {
        name: String,
        description: String,
        uri: String,
    }

    // === COLLECTION REGISTRY ===
    public struct CollectionRegistry has key, store {
        id: UID,
        collections: Table<ID, address>,
        user_collections: Table<address, vector<ID>>,
    }

    // === COIN STRUCTURES ===
    public struct DROPFORGE_COIN has drop {}

    public struct CoinTreasury has key, store {
        id: UID,
        treasury_cap: TreasuryCap<DROPFORGE_COIN>,
        creator: address,
        name: String,
        symbol: String,
        decimals: u8,
    }

    // === EVENTS ===
    public struct CollectionCreated has copy, drop {
        collection_id: ID,
        creator: address,
        name: String,
    }

    public struct NFTMinted has copy, drop {
        nft_id: ID,
        collection_id: ID,
        token_id: u64,
        minter: address,
    }

    public struct BatchMinted has copy, drop {
        collection_id: ID,
        count: u64,
        base_token_id: u64,
    }

    public struct NFTTransferred has copy, drop {
        nft_id: ID,
        from: address,
        to: address,
    }

    public struct RoyaltyPaid has copy, drop {
        nft_id: ID,
        creator: address,
        amount: u64,
    }

    public struct CoinLaunched has copy, drop {
        treasury_id: ID,
        creator: address,
        symbol: String,
        name: String,
    }

    public struct CoinMinted has copy, drop {
        treasury_id: ID,
        amount: u64,
        recipient: address,
    }

    public struct CoinTransferred has copy, drop {
        from: address,
        to: address,
        amount: u64,
    }

    // === ERRORS ===
    const EInvalidSupply: u64 = 1;
    const EMaxSupplyReached: u64 = 2;
    const EUnauthorized: u64 = 3;
    const EInsufficientPayment: u64 = 4;
    const EInvalidRoyalty: u64 = 5;
    const EInvalidDecimals: u64 = 6;

    // === INIT ===
    fun init(otw: DROPFORGE, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);

        // NFT Display
        let mut display = display::new<NFT>(&publisher, ctx);
        display::add(&mut display, string::utf8(b"name"), string::utf8(b"{name}"));
        display::add(&mut display, string::utf8(b"description"), string::utf8(b"{description}"));
        display::add(&mut display, string::utf8(b"image_url"), string::utf8(b"{url}"));
        display::add(&mut display, string::utf8(b"collection"), string::utf8(b"{collection_id}"));
        display::add(&mut display, string::utf8(b"token_id"), string::utf8(b"{token_id}"));
        display::update_version(&mut display);

        // Transfer Policy
        let (policy, policy_cap) = transfer_policy::new<NFT>(&publisher, ctx);
        transfer::public_share_object(policy);
        transfer::public_transfer(policy_cap, tx_context::sender(ctx));

        // Initialize registry
        let registry = CollectionRegistry {
            id: object::new(ctx),
            collections: table::new(ctx),
            user_collections: table::new(ctx),
        };

        transfer::public_share_object(registry);
        transfer::public_transfer(publisher, tx_context::sender(ctx));
        transfer::public_transfer(display, tx_context::sender(ctx));
    }

    // ============= NFT FUNCTIONS =============

    // === CREATE COLLECTION ===
    public entry fun create_collection(
        registry: &mut CollectionRegistry,
        name: vector<u8>,
        description: vector<u8>,
        max_supply: u64,
        royalty_bps: u16,
        base_uri: vector<u8>,
        mint_price: u64,
        ctx: &mut TxContext,
    ) {
        assert!(max_supply > 0, EInvalidSupply);
        assert!(royalty_bps <= 10000, EInvalidRoyalty);

        let creator = tx_context::sender(ctx);
        let collection = Collection {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            creator,
            max_supply,
            minted_count: 0,
            royalty_bps,
            base_uri: string::utf8(base_uri),
            mint_price,
            treasury: balance::zero(),
            metadata: table::new(ctx),
        };

        let collection_id = object::id(&collection);

        // Register collection
        if (!table::contains(&registry.user_collections, creator)) {
            table::add(&mut registry.user_collections, creator, vector[collection_id]);
        } else {
            let collections = table::borrow_mut(&mut registry.user_collections, creator);
            vector::push_back(collections, collection_id);
        };

        event::emit(CollectionCreated {
            collection_id,
            creator,
            name: collection.name,
        });

        transfer::share_object(collection);
    }

    // === MINT SINGLE NFT ===
    public entry fun mint_nft(
        collection: &mut Collection,
        name: vector<u8>,
        description: vector<u8>,
        uri: vector<u8>,
        payment: Coin<SUI>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(collection.minted_count < collection.max_supply, EMaxSupplyReached);
        assert!(coin::value(&payment) >= collection.mint_price, EInsufficientPayment);

        let token_id = collection.minted_count;

        // Store metadata
        table::add(
            &mut collection.metadata,
            token_id,
            NFTMetadata {
                name: string::utf8(name),
                description: string::utf8(description),
                uri: string::utf8(uri),
            },
        );

        // Create NFT
        let nft = NFT {
            id: object::new(ctx),
            name: string::utf8(name),
            description: string::utf8(description),
            url: url::new_unsafe_from_bytes(uri),
            collection_id: object::id(collection),
            token_id,
            creator: collection.creator,
            royalty_bps: collection.royalty_bps,
        };

        let nft_id = object::id(&nft);
        collection.minted_count = collection.minted_count + 1;

        // Handle payment
        balance::join(&mut collection.treasury, coin::into_balance(payment));

        event::emit(NFTMinted {
            nft_id,
            collection_id: object::id(collection),
            token_id,
            minter: recipient,
        });

        transfer::public_transfer(nft, recipient);
    }

    // === BATCH MINT ===
    public entry fun batch_mint(
        collection: &mut Collection,
        names: vector<vector<u8>>,
        descriptions: vector<vector<u8>>,
        uris: vector<vector<u8>>,
        payment: Coin<SUI>,
        recipients: vector<address>,
        ctx: &mut TxContext,
    ) {
        let count = vector::length(&names);
        assert!(count == vector::length(&descriptions), 0);
        assert!(count == vector::length(&uris), 0);
        assert!(count == vector::length(&recipients), 0);
        assert!(collection.minted_count + count <= collection.max_supply, EMaxSupplyReached);
        assert!(coin::value(&payment) >= collection.mint_price * (count as u64), EInsufficientPayment);

        let mut i = 0;
        let base_token_id = collection.minted_count;

        while (i < count) {
            let token_id = collection.minted_count;
            let name = *vector::borrow(&names, i);
            let description = *vector::borrow(&descriptions, i);
            let uri = *vector::borrow(&uris, i);
            let recipient = *vector::borrow(&recipients, i);

            // Store metadata
            table::add(
                &mut collection.metadata,
                token_id,
                NFTMetadata {
                    name: string::utf8(name),
                    description: string::utf8(description),
                    uri: string::utf8(uri),
                },
            );

            // Create NFT
            let nft = NFT {
                id: object::new(ctx),
                name: string::utf8(name),
                description: string::utf8(description),
                url: url::new_unsafe_from_bytes(uri),
                collection_id: object::id(collection),
                token_id,
                creator: collection.creator,
                royalty_bps: collection.royalty_bps,
            };

            collection.minted_count = collection.minted_count + 1;
            transfer::public_transfer(nft, recipient);

            i = i + 1;
        };

        // Handle payment
        balance::join(&mut collection.treasury, coin::into_balance(payment));

        event::emit(BatchMinted {
            collection_id: object::id(collection),
            count,
            base_token_id,
        });
    }

    // === TRANSFER NFT ===
    public entry fun transfer_nft(nft: NFT, to: address, ctx: &TxContext) {
        event::emit(NFTTransferred {
            nft_id: object::id(&nft),
            from: tx_context::sender(ctx),
            to,
        });
        transfer::public_transfer(nft, to);
    }

    // === BURN NFT ===
    public entry fun burn_nft(nft: NFT) {
        let NFT {
            id,
            name: _,
            description: _,
            url: _,
            collection_id: _,
            token_id: _,
            creator: _,
            royalty_bps: _,
        } = nft;
        object::delete(id);
    }

    // === KIOSK: PLACE & LIST ===
    public entry fun place_and_list(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        nft: NFT,
        price: u64,
    ) {
        let nft_id = object::id(&nft);
        kiosk::place(kiosk, cap, nft);
        kiosk::list<NFT>(kiosk, cap, nft_id, price);
    }

    // === KIOSK: PURCHASE ===
    public entry fun purchase_nft(
        kiosk: &mut Kiosk,
        nft_id: ID,
        payment: Coin<SUI>,
        policy: &TransferPolicy<NFT>,
        ctx: &mut TxContext,
    ) {
        let (nft, request) = kiosk::purchase<NFT>(kiosk, nft_id, payment);
        transfer_policy::confirm_request(policy, request);
        transfer::public_transfer(nft, tx_context::sender(ctx));
    }

    // === WITHDRAW FROM COLLECTION ===
    public entry fun withdraw_from_collection(
        collection: &mut Collection,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == collection.creator, EUnauthorized);
        
        let withdrawn = balance::split(&mut collection.treasury, amount);
        let coin_out = coin::from_balance(withdrawn, ctx);
        transfer::public_transfer(coin_out, tx_context::sender(ctx));
    }

    // ============= COIN FUNCTIONS =============

    // === LAUNCH COIN ===
    public entry fun launch_coin(
        name: vector<u8>,
        symbol: vector<u8>,
        decimals: u8,
        icon_url: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(decimals <= 18, EInvalidDecimals);

        let (treasury_cap, metadata) = coin::create_currency<DROPFORGE_COIN>(
            DROPFORGE_COIN {},
            decimals,
            symbol,
            name,
            b"DropForge Community Token",
            option::some(url::new_unsafe_from_bytes(icon_url)),
            ctx,
        );

        let coin_treasury = CoinTreasury {
            id: object::new(ctx),
            treasury_cap,
            creator: tx_context::sender(ctx),
            name: string::utf8(name),
            symbol: string::utf8(symbol),
            decimals,
        };

        let treasury_id = object::id(&coin_treasury);

        event::emit(CoinLaunched {
            treasury_id,
            creator: tx_context::sender(ctx),
            symbol: string::utf8(symbol),
            name: string::utf8(name),
        });

        transfer::share_object(coin_treasury);
        transfer::public_freeze_object(metadata);
    }

    // === MINT COIN ===
    public entry fun mint_coin(
        treasury: &mut CoinTreasury,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == treasury.creator, EUnauthorized);

        let coin_out = coin::mint(&mut treasury.treasury_cap, amount, ctx);
        
        event::emit(CoinMinted {
            treasury_id: object::id(treasury),
            amount,
            recipient,
        });

        transfer::public_transfer(coin_out, recipient);
    }

    // === BATCH MINT COIN ===
    public entry fun batch_mint_coin(
        treasury: &mut CoinTreasury,
        amounts: vector<u64>,
        recipients: vector<address>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == treasury.creator, EUnauthorized);
        assert!(vector::length(&amounts) == vector::length(&recipients), 0);

        let mut i = 0;
        let len = vector::length(&amounts);

        while (i < len) {
            let amount = *vector::borrow(&amounts, i);
            let recipient = *vector::borrow(&recipients, i);

            let coin_out = coin::mint(&mut treasury.treasury_cap, amount, ctx);
            
            event::emit(CoinMinted {
                treasury_id: object::id(treasury),
                amount,
                recipient,
            });

            transfer::public_transfer(coin_out, recipient);
            i = i + 1;
        };
    }

    // === TRANSFER COIN ===
    public entry fun transfer_coin(
        coin_in: Coin<DROPFORGE_COIN>,
        to: address,
        ctx: &TxContext,
    ) {
        event::emit(CoinTransferred {
            from: tx_context::sender(ctx),
            to,
            amount: coin::value(&coin_in),
        });
        transfer::public_transfer(coin_in, to);
    }

    // === BURN COIN ===
    public entry fun burn_coin(
        treasury: &mut CoinTreasury,
        coin_in: Coin<DROPFORGE_COIN>,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == treasury.creator, EUnauthorized);
        coin::burn(&mut treasury.treasury_cap, coin_in);
    }

    // ============= GETTERS =============

    public fun get_collection_info(
        collection: &Collection,
    ): (String, String, u64, u64, u16, u64) {
        (
            collection.name,
            collection.description,
            collection.minted_count,
            collection.max_supply,
            collection.royalty_bps,
            collection.mint_price,
        )
    }

    public fun get_nft_info(nft: &NFT): (String, String, u64, address, u16) {
        (nft.name, nft.description, nft.token_id, nft.creator, nft.royalty_bps)
    }

    public fun get_collection_creator(collection: &Collection): address {
        collection.creator
    }

    public fun get_treasury_balance(collection: &Collection): u64 {
        balance::value(&collection.treasury)
    }

    public fun can_mint(collection: &Collection): bool {
        collection.minted_count < collection.max_supply
    }

    public fun remaining_supply(collection: &Collection): u64 {
        collection.max_supply - collection.minted_count
    }

    public fun get_coin_info(treasury: &CoinTreasury): (String, String, u8, address) {
        (treasury.name, treasury.symbol, treasury.decimals, treasury.creator)
    }

    public fun get_coin_total_supply(treasury: &CoinTreasury): u64 {
        coin::total_supply(&treasury.treasury_cap)
    }
}
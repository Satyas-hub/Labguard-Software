package com.labguard.controller;

import com.labguard.dto.EquipmentDtos.*;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.EquipmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/equipment")
@RequiredArgsConstructor
public class EquipmentController {

    private final EquipmentService equipmentService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<EquipmentDetailDto>> getAllEquipment() {
        return ResponseEntity.ok(equipmentService.getAllEquipment());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EquipmentDetailDto> getEquipmentDetail(@PathVariable UUID id) {
        return ResponseEntity.ok(equipmentService.getEquipmentDetail(id));
    }

    @GetMapping("/asset/{assetId}")
    public ResponseEntity<EquipmentDetailDto> getByAssetId(@PathVariable String assetId) {
        return ResponseEntity.ok(equipmentService.getEquipmentByAssetId(assetId));
    }

    /**
     * QR Code Scan resolution endpoint
     */
    @GetMapping("/qr/{assetId}")
    public ResponseEntity<QrScanResultDto> scanQr(@PathVariable String assetId) {
        return ResponseEntity.ok(equipmentService.scanEquipmentQr(assetId));
    }

    @PostMapping("/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> assignEquipment(
        @Valid @RequestBody AssignEquipmentRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User admin = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        equipmentService.assignEquipmentToPc(request, admin);
        return ResponseEntity.ok().build();
    }
}

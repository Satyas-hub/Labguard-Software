package com.labguard.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public class AuthDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        @NotBlank(message = "Email is required")
        private String email;

        @NotBlank(message = "Password is required")
        private String password;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AuthResponse {
        private UUID userId;
        private String email;
        private String fullName;
        private String role; // ADMIN, FACULTY, LAB_ASSISTANT, STUDENT
        private String token;
        private List<String> assignedLabs;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CurrentUserResponse {
        private UUID userId;
        private String email;
        private String fullName;
        private String role;
        private String phone;
        private Object profileDetails; // StudentDto / FacultyDto / AssistantDto
        private List<String> assignedLabCodes;
    }

    // Windows PC Client Kiosk Authentication Request
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ClientAuthRequest {
        @NotBlank(message = "Lab code is required")
        private String labCode;

        @NotBlank(message = "PC code is required")
        private String pcCode;

        @NotBlank(message = "Identifier is required")
        private String identifier; // Student ID or Faculty Employee ID or Email

        @NotBlank(message = "Password is required")
        private String password;

        @NotBlank(message = "Requested role is required")
        private String role; // STUDENT or FACULTY
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ClientAuthResponse {
        private boolean authenticated;
        private String token;
        private UUID sessionId;
        private String fullName;
        private String identifier;
        private String department;
        private String section;
        private String labCode;
        private String pcCode;
        private boolean keyboardVerified;
        private boolean mouseVerified;
        private String message;
    }
}
